#!/usr/bin/env python

log_out_path = '/var/log/iptvrec/out'
log_err_path = '/var/log/iptvrec/err'
config_path = '/etc/iptvrec/iptvrecrc'

#task_pid_dir_path = '/var/run/iptvrec/tasks/'

daemon_pid_path = '/var/run/iptvrec/iptvrec.pid'
tasks_run_path = '/var/run/iptvrec/tasks.json'

data_path = '/var/lib/iptvrec/data.json'

web_path = '/usr/share/iptvrec'

vlc_path = '/usr/bin/cvlc'

config = {
        'host': 'localhost',
        'port': 1234,
        'log': True,
        'video_dir': '/tmp/',
        'channels_m3u': None,
    }
data = None
running_task_list = []
