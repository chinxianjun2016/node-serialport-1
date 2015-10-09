var SerialPort = require("serialport"); //引入串口模块
var iconv = require('iconv-lite');  //引入数据编码格式转换模块
var http = require('http');   //引入http模块
var express = require('express'); //引入express模块
var sio = require('socket.io'); //引入socket.io模块
var app = express();  //创建express实例
var path = require('path');  //引入path模块
var fs = require('fs');  //引入fs模块
var xlsx = require('node-xlsx');//引入读取excel文件模块


    var serialPort = new SerialPort.SerialPort('COM4', {
        baudrate: 9600,  //波特率设置
        databits : 8,  //数据位
        parity: 'none',  //校验位
        stopbits: 1 ,//停止位
       // parser: SerialPort.parsers.readline("\n")    
       // 这行不要加，加上程序就出现编码不正常现象
    },function(err)
    {
        if(err)
        {
            if(err.stack.slice(25,38) == 'Access denied')  //如果串口已经打开
            {
                //console.log(err.stack.slice(25,38));
                console.log(err.stack.slice(19,23) + '已经打开'); //获取打开的端口号，并返回端口信息
            }
            else
            {
                console.log(err);
            }
        }

    });
console.log('1111')
console.log(serialPort);
    serialPort.on("open", function (err) {
        if(err)
        {

            console.log(err + "打开串口出错，请重试");
            message_err +=  "打开串口出错，请重试";
        }
        else
        {console.log('2222');
            console.log(serialPort);
            console.log('串口已经打开');

            serialPort.on('data', function(info) {
                //   console.log('data received: ' + info);
                console.log('data_change:'+iconv.decode(info,'hex'));
                //  buf = new Buffer(iconv.decode(info,'gb2312'));
                //  console.log(buf.toString('hex'));
                // console.log(buf.toString('ascii'));

            });

          var buf = new Buffer('FEFEFE68200671163300111101031F90001D16','hex');
                console.log(buf);
                serialPort.write(buf, function(err, results) {
                    if(err)
                    {
                        console.log('err ' + err);
                    }
                    else
                    {
                        console.log('发送数据字节长度： ' + results);  //发出去的数据字节长度
                    }
                })
            console.log('Calling write...');
            //serialPort.write('FEFEFE68208710453100111101031F90006A16');


        }
    });

