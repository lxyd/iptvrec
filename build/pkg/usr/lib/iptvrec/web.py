#!/usr/bin/env python

import json, time
from cherrypy import *
from threading import Thread
from copy import deepcopy
from os import path
import cherrypy

import common
from common import *

class WebIfaceThread(Thread):
    def __init__(self, on_update_data):
        Thread.__init__(self)

        self.web = WebIface(on_update_data)

    def run(self):
        cherrypy.quickstart(self.web, config = {
            'global': {
                'server.socket_host': config['host'],
                'server.socket_port': config['port'],
            },
            '/': {
                'tools.staticdir.on' : True,
                'tools.staticdir.dir' : web_path,
                'tools.staticdir.index' : 'iptvrec.html',
            },
         })


class WebIface(object):
    def __init__(self, on_update_data):
        self.on_update_data = on_update_data

    def get_data(self):
        return json.dumps(common.data, sort_keys=True, indent=4)

    def get_running_task_list(self):
        return json.dumps(common.running_task_list, sort_keys=True, indent=4)

    def save_task(self, task):
        task = json.loads(task)
        data = deepcopy(common.data)

        if task['id'] == 0:
            task['id'] = str(time.time()).replace('.', '')
        else:
            # if this is a replacement for an existing task
            data['tasks'] = [t for t in data['tasks'] if t['id'] != task['id']]

        data['tasks'].append(task)

        self.on_update_data(data)

    def delete_task(self, id):
        data = deepcopy(common.data)
        data['tasks'] = [t for t in data['tasks'] if t['id'] != id]

        self.on_update_data(data)


    get_data.exposed = True
    get_running_task_list.exposed = True
    save_task.exposed = True
    delete_task.exposed = True
