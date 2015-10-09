// var SerialPort = require('serialport');
// serialPort = new SerialPort.SerialPort('COM5', {
//           baudrate: 9600,  //波特率设置
//           databits : 8,  //数据位
//           parity: 'none',  //校验位
//           stopbits: 1 //停止位
//           //parser: SerialPort.parsers.readline("\n")     //收到的数据换行显示
//       })
//  serialPort.on("open", function (err) {
//         if(err)
//         {
//             console.log(err + "打开串口出错，请重试");
//             message_err +=  "打开串口出错，请重试";
//         }
//         else
//         {
//             console.log('串口已经打开');
//             var buf = new Buffer('FEFEFE68200671163300111101031F90001D16','hex');
// serialPort.write(buf);
// serialPort.on('data',function(data)
// {
// 	console.log(data);
// })

//         }
//     })
	var SerialPort = require('serialport').SerialPort;
sp = new SerialPort('COM5')

 sp.on("open", function (err) {
        if(err)
        {
            console.log(err + "打开串口出错，请重试");
            message_err +=  "打开串口出错，请重试";
        }
        else
        {
            console.log('串口已经打开');
            var buf = new Buffer('FEFEFE68200671163300111101031F90001D16','hex');
sp.write(buf);
sp.on('data',function(data)
{
	console.log(data);
})

        }
    })