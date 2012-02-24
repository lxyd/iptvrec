#!/usr/bin/env python

import sys, time, json, re, os, signal, errno
from copy import deepcopy
from threading import Thread, Lock
from subprocess import Popen
from datetime import datetime, timedelta
from glob import glob
from os import path
from urllib import request

from daemon import Daemon
from web import WebIfaceThread

import common
from common import *

"""
data = {
    'channels' : [
        {
            'url' : 'udp://...',
            'name' : 'some channel'
        },
        ...
    ],
    'tasks' : [
        {
            'id' : 123,
            'enabled': true,
            'url' : 'udp://...',
            'name' : 'Peredacha',
            'date' : {
                'year' : 2012,
                'month' : 1,
                'day' : 15
            },
            'start' : {
                'hour' : 23,
                'minute' : 30
            },
            'end' : {
                'hour' : 2,
                'minute' : 10
            },
        },
        {
            'id' : 124,
            'enabled': true,
            'url' : 'udp://...',
            'name' : 'Peredacha - 2',
            'days' : [1, 2, 3, 4, 5],
            'start' : {
                'hour' : 23,
                'minute' : 30
            },
            'end' : {
                'hour' : 2,
                'minute' : 10
            },
        },
        ...
    ]
}
"""

def is_task_match(task, dt):
    if not task['enabled']:
        return False

    if task['date']:
        d = task['date']
        start = datetime(d['year'], d['month'], d['day'], task['start']['hour'], task['start']['minute'])
        end = datetime(d['year'], d['month'], d['day'], task['end']['hour'], task['end']['minute'])
        end += timedelta(minutes=1)
        if end <= start:
            end += timedelta(days=1)

        return start <= dt and end >= dt
    elif task['days']:
        start1 = datetime(dt.year, dt.month, dt.day, task['start']['hour'], task['start']['minute'])
        end1 = datetime(dt.year, dt.month, dt.day, task['end']['hour'], task['end']['minute'])
        end1 += timedelta(minutes=1)
        if end1 <= start1:
            end1 += timedelta(days=1)

        start2 = start1 - timedelta(days=1)
        end2 = end1 - timedelta(days=1)

        # converting weekday from pythonic 0-6 to 1-7 used in this program
        return ((start1 <= dt and end1 >= dt and start1.weekday() + 1 in task['days']) or
               (start2 <= dt and end2 >= dt and start2.weekday() + 1 in task['days']))
    else:
        return False

def is_task_obsolete(task, dt):
    if task['date']:
        d = task['date']
        start = datetime(d['year'], d['month'], d['day'], task['start']['hour'], task['start']['minute'])
        end = datetime(d['year'], d['month'], d['day'], task['end']['hour'], task['end']['minute'])
        end += timedelta(minutes=1)
        if end <= start:
            end += timedelta(days=1)

        return dt > end
    elif task['days']:
        return False
    else:
        return False

def get_task_filename(task, start):
    chan = [c['name'] for c in common.data['channels'] if c['url'] == task['url']][0]
    chan = re.sub(r'[\\/:*?"<>|]', '', chan)
    name = re.sub(r'[\\/:*?"<>|]', '', task['name'])

    return "%04d-%02d-%02d %02d-%02d %s [%s].avi" % (
            start.year, start.month, start.day, start.hour, start.minute, name, chan)


def load_json(filepath):
    content = None
    try:
        fil = None
        fil = open(filepath, 'r')
        content = json.load(fil)
    except:
        pass
    finally:
        if fil is not None:
            fil.close()

    return content


def store_json(filpath, content):
    fil = None
    try:
        fil = open(filpath, 'w')
        json.dump(content, fil, sort_keys=True, indent=4)
    except:
        pass
    finally:
        if fil is not None:
            fil.close()


class RecDaemon(Daemon):
    def update_channels(self):

        if config['channels_m3u'] is not None:
            try:
                webfile = request.urlopen(config['channels_m3u'])
                state = 0
                for l in webfile:
                    l = str(l, 'UTF-8', 'ignore')

                    if re.search('^\s*//', l) is not None:
                        continue
                    if re.search('^\s*$', l) is not None:
                        continue

                    m = re.search("^\s*#EXTINF.*group-title=(.*)$", l)
                    if m is not None:
                        state = 1
                        name = m.groups()[0].strip()
                    elif state == 1:
                        url = l.strip()
                        state = 0

                        if not [c for c in common.data['channels'] if c['url'] == url]:
                            common.data['channels'].append({'url':url, 'name':name})

                self.on_update_data(common.data)
            except:
                pass


    def on_update_data(self, new_data):

        common.data = deepcopy(new_data)
        store_json(data_path, common.data)

        self.process_tasks()

    def process_tasks(self):
        lock = Lock()
        try:
            lock.acquire()

            # load current tasks dict
            running_tasks = load_json(tasks_run_path)
            if running_tasks is None:
                running_tasks = {}
            # remove tasks not actually running
            running_tasks = { tid: pid for (tid, pid) in running_tasks.items()
                    if path.exists("/proc/%d" % pid) }

            tasks_to_save = set()

            now = datetime.now()
            for t in common.data['tasks']:
                if is_task_match(t, now): # task must be running ...
                    if t['id'] not in running_tasks: # ... but is not
                        fn = path.join(config['video_dir'], get_task_filename(t, now)).replace("'", "\\'")
                        out_param = "#std{access=file,mux=mp4,dst='%s'}" % fn
                        sp = Popen((vlc_path, "--sout", out_param.encode("utf-8"), t['url']))
                        running_tasks[t['id']] = sp.pid
                else: # task must not be running ...
                    if t['id'] in running_tasks: # ... but is
                        os.kill(running_tasks[t['id']], signal.SIGTERM)
                        running_tasks.pop(t['id'])

                if not is_task_obsolete(t, now):
                    tasks_to_save.add(t['id'])
                else:
                    t['enabled'] = False

            # now clear tasks that are running for some reason but are not in list at all
            for tid in list(running_tasks.keys()):
                if tid not in tasks_to_save:
                    os.kill(running_tasks[tid], signal.SIGTERM)
                    running_tasks.pop(tid)

            common.running_task_list = list(running_tasks.keys())

            store_json(tasks_run_path, running_tasks)

            # if there are obsolete tasks, remove them and save data
            if [ t for t in common.data['tasks'] if is_task_obsolete(t, now) ]:
                #common.data['tasks'] = [ t for t in common.data['tasks'] if not is_task_obsolete(t, now) ]
                store_json(data_path, common.data)
        finally:
            lock.release()

    def run(self):

        common.data = load_json(data_path)

        if common.data is None:
            common.data = {
                    'channels': [],
                    'tasks': [],
                }

        self.update_channels()

        web = WebIfaceThread(self.on_update_data)
        web.daemon = True
        web.start()
        while True:
            self.process_tasks()
            time.sleep(30)
 
if __name__ == "__main__":
    cfg = None
    cfgfile = None
    try:
        cfgfile = open(config_path, 'r')
        cfg = json.load(cfgfile)
    except:
        print('Config file %s not found, using defaults' % config_path)
    finally:
        if cfgfile is not None:
            cfgfile.close()

    if cfg is not None:
        config.update(cfg)


    if config['log']:
        daemon = RecDaemon(daemon_pid_path, '/dev/null', log_out_path, log_err_path)
    else:
        daemon = RecDaemon(daemon_pid_path)

    if len(sys.argv) == 2:
        if 'start' == sys.argv[1]:
            daemon.start()
        elif 'stop' == sys.argv[1]:
            daemon.stop()
        elif 'restart' == sys.argv[1]:
            daemon.restart()
        else:
            print("Unknown command")
            sys.exit(2)
        sys.exit(0)
    else:
        print("usage: %s start|stop|restart" % sys.argv[0])
        sys.exit(2)
