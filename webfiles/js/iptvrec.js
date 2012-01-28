(function($) {
    var data = null,
        running_task_list = [];
    function format_channel(url) {
        var res = null;
        data.channels.forEach(function(chan) {
            if(chan.url == url) {
                res = chan.name;
            }
        });
        return res || url;
    }
    function format_time(time) {
        var h = time.hour, m = time.minute;
        return (h < 10 ? "0" : "") + h + 
         ":" + (m < 10 ? "0" : "") + m;
    }
    function parse_time(str) {
        var ar, res, now = new Date();

        if((ar = $.trim(str).split(':')).length == 2) {
        } else if((ar = $.trim(str).split('.')).length == 2) {
        } else if((ar = $.trim(str).split(' ')).length == 2) {
        } else if((ar = $.trim(str).split(';')).length == 2) {
        } else if((ar = $.trim(str).split(',')).length == 2) {
        }
        res = {
            hour: parseInt($.trim(ar[0]), 10),
            minute: parseInt($.trim(ar[1]), 10)
        }

        now.setHours(res.hour);
        now.setMinutes(res.minute);

        if(now.getHours() != res.hour || now.getMinutes() != res.minute) {
            throw new Error('Недопустимое время');
        }

        return res;
    }
    function format_date(date) {
        if(!date) { return ''; }
        var y = date.year, m = date.month, d = date.day;
        return (d < 10 ? "0" : "") + d + 
         "." + (m < 10 ? "0" : "") + m +
         "." + y;
    }
    function parse_date(str) {
        var ar, res, now = new Date();
        if((ar = str.split('.')).length == 3) {
            res = {
                day: parseInt(ar[0], 10),
                month: parseInt(ar[1], 10),
                year: parseInt(ar[2], 10)
            };
        } else if((ar = str.split('-')).length == 3) {
            res = {
                day: parseInt(ar[2], 10),
                month: parseInt(ar[1], 10),
                year: parseInt(ar[0], 10)
            };
        } else {
            throw new Error("Дата '" + str + "' введена некорректно");
        }

        now.setFullYear(res.year);
        now.setMonth(res.month - 1);
        now.setDate(res.day);

        if(now.getFullYear() != res.year || now.getMonth() != res.month - 1 || now.getDate() != res.day) {
            throw new Error('Недопустимая дата');
        }

        return res;
    }
    function format_days(days) {
        var res = "", names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
        return days.sort().map(function(d) {
            return names[d];
        }).join(', ');
    }
    function get_nearest_run(task) {
        if(task.date) {
            return new Date(task.date.year, task.date.month - 1, task.date.day, 
                task.start.hour, task.start.minute);
        } else if(task.days) {
            var now = new Date(),
                days = task.days.sort().map(function(d) {
                    return d%7; // convert 1-7 to 0-6 for js
                });

            for(var i = 0; i <= 7; i++) {
                var date = new Date(now.getTime() + i * 24*60*60*1000);
                date.setHours(task.start.hour);
                date.setMinutes(task.start.minute);

                if(days.indexOf(date.getDay()) != -1 && date > now) {
                    return date;
                }
            }
        }
    }
    function compare_tasks(t1, t2) {
        var r1 = t1.id in running_task_list,
            r2 = t2.id in running_task_list;
        if(r1 && !r2)
            return -1;
        else if(r2 && !r1)
            return 1;
        else
            return get_nearest_run(t1) - get_nearest_run(t2);
    }
    function render_task(tr, task) {
        var symbol = '✓';
        tr.attr('id', 'task_' + task.id);
        tr.data('id', task.id);

        if(task.id in running_task_list) {
            tr.addClass('running');
            symbol = '▷'; //'▶‣';
        } else if(!task.enabled) {
            tr.addClass('disabled');
            symbol = '✗';
        }

        tr.html(
            $.HotMilk.item.display(task)
        );

        $('TD[data-field=enabled]', tr).text(symbol);
        $('TD[data-field=date]', tr).text(task.date ? format_date(task.date) : format_days(task.days));
        $('TD[data-field=channel]', tr).text(format_channel(task.url));
        $('TD[data-field=name]', tr).text(task.name);
        $('TD[data-field=start]', tr).text(format_time(task.start));
        $('TD[data-field=end]', tr).text(format_time(task.end));
    }

    function reload_data() {
        $.ajax('/get_data', {
            dataType: 'json',
            success: function(new_data) {
                $.ajax('/get_running_task_list', {
                    dataType: 'json',
                    success: function(new_running_task_list) {
                        // store task ids
                        running_task_list = {};
                        new_running_task_list.forEach(function(rt) {
                            running_task_list[rt] = true;
                        });

                        data = new_data;
                        data.tasks = data.tasks.sort(compare_tasks);

                        var tbody = $('#tasks TBODY');
                        tbody.html('');
                        data.tasks.forEach(function(t) {
                            var e = $('<tr>');
                            render_task(e, t);
                            tbody.append(e);
                        });
                    }                    
                });
            }
        });
    }

    function begin_edit(id) {
        var task = null,
            now = new Date(),
            e = null;

        id = id || 0; /* null, undefined, 0 - new task */

        if($('#tasks .edit').length > 0) {
            return;
        }

        if(!id) {
            var then = new Date(now.getTime() + 60 * 60 * 1000);

            task = {
                enabled: true,
                date: {
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate()
                },
                start: {
                    hour: now.getHours(),
                    minute: now.getMinutes()
                },
                end: {
                    hour: then.getHours(),
                    minute: then.getMinutes()
                }
            };

            e = $('<tr>');
            e.attr('id', 'task_' + id);
            e.data('id', id);
            $('#tasks TBODY').prepend(e);
        } else {
            data.tasks.forEach(function(t) {
                if(t.id == id) {
                   task = t;
                }
            });

            e = $('#task_'+id);
        }

        if(task == null) {
            throw new Error("No such task")
        }

        e.addClass('edit');
        e.removeClass('disabled'); // if any
        e.html($.HotMilk.item.edit(task));

        var chan_sel = $('#tasks TR.edit SELECT[name=channel]')
        data.channels.forEach(function(chan) {
            chan_sel.append(
                $.HotMilk.chanlist.item(chan)
            );
        });

        $('INPUT[name=enabled]', e).attr('checked', task.enabled);
        if(task.date) {
            $('INPUT[name=date-type][value=date]', e).attr('checked', true);
            $('INPUT[name=date]', e).val(format_date(task.date));
        } else {
            $('INPUT[name=date-type][value=days]', e).attr('checked', true);
            task.days.forEach(function(d) {
                $('INPUT[name=days][value='+d+']', e).attr('checked', true);
            });
        }

        $('SELECT[name=channel]', e).val(task.url);
        $('INPUT[name=name]', e).val(task.name);
        $('INPUT[name=start]', e).val(format_time(task.start));
        $('INPUT[name=end]', e).val(format_time(task.end));

        if(id in running_task_list) {
            $(':input', e).attr('disabled', true);
            $('INPUT[name=end]', e).attr('disabled', false);
            $('INPUT[name=enabled]', e).attr('disabled', false);
        } else {
            $('INPUT[name=date]', e).datepicker();
        }
    }

    function revert_item(id) {
        id = id || 0;

        var e = $('#task_' + id),
            task;

        if(!id) {
            e.remove();
        } else {
            data.tasks.forEach(function(t) {
                if(t.id == id) {
                   task = t;
                }
            });
            render_task(e, task);
            e.removeClass('edit');
        }
    }

    function save_item(id) {
        id = id || 0;

        var e = $('#task_' + id),
            task;

        try{
            task = {
                id: id,
                enabled: $('INPUT[name=enabled]', e).is(':checked'),
                url: $('SELECT[name=channel]', e).val(),
                name: $.trim($('INPUT[name=name]', e).val()),
                start: parse_time($('INPUT[name=start]', e).val()),
                end: parse_time($('INPUT[name=end]', e).val()),
                date: null,
                days: [] 
            };

            if(!task.url) {
                throw new Error('Не заполнен канал');
            }

            if(!task.name) {
                throw new Error('Не заполнено название');
            } else if(/[\\\/:*?"<>|]/.test(task.name)) {
                throw new Error('В названии нельзя использовать знаки: \\ / : * ? " < > |');
            }

            if($('INPUT[name=date-type][value=date]', e).is(':checked')) {
                task.date = parse_date($('INPUT[name=date]', e).val());
            } else {
                $('INPUT[name=days]:checked', e).each(function() {
                    task.days.push(parseInt($(this).val(), 10));
                });
                if(!task.days) {
                    throw new Error('Ни один день не выбран');
                }
            }

            $.ajax('/save_task', {
                dataType: 'json',
                data: {
                    task: $.toJSON(task)
                },
                success: function(unused) {
                    reload_data();
                }
            });
        } catch(e) {
            alert(e.message);
        }
    }

    function delete_item(id) {
        var confirmText = 'Удалить эту программу?';
        if(id in running_task_list) {
            confirmText = 'Эта программа сейчас записывается. При удалении запись будет остановлена. Продолжить?';
        }
        if(confirm(confirmText)) {
            $.ajax('/delete_task', {
                dataType: 'json',
                data: {'id': id},
                success: function(unused) {
                    reload_data();
                }
            });
        }
    }

    $.datepicker.setDefaults($.datepicker.regional['ru']);
    $(function() {
        reload_data();

        $(document).on('keyup', 'INPUT[type=time]', function(ev) {
            var val = $(this).val();
            if(ev.keyCode != 8) {
                if(val.length == 2) {
                    if(-1 == ": .,;".indexOf(val.charAt(1))) {
                        val += ":";
                        $(this).val(val);
                    }
                }
            }
        });

        setInterval(function(){
            if($('#tasks .edit').length == 0) {
                reload_data();
            }
        }, 60000);

        $(document).on('click', '#tasks TD[data-field=date] DIV', function() {
            $('INPUT[type=radio]', this).attr('checked', true);
            return true;
        });

        $(document).on('focus', '#tasks INPUT[type=time]', function() {
            this.select();
            return true;
        });

        $(document).on('click', '#tasks .btn-add-item', function(){
            begin_edit(0);
            return false;
        });
        $(document).on('click', '#tasks .btn-edit-item', function(){
            begin_edit($(this).closest('TR').data('id'));
            return false;
        });
        $(document).on('click', '#tasks .btn-save-item', function(){
            save_item($(this).closest('TR').data('id'));
            return false;
        });
        $(document).on('click', '#tasks .btn-revert-item', function(){
            revert_item($(this).closest('TR').data('id'));
            return false;
        });
        $(document).on('click', '#tasks .btn-delete-item', function(){
            delete_item($(this).closest('TR').data('id'));
            return false;
        });
    });
})(jQuery);

