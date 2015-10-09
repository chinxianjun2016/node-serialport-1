/***************************读取excel中的数据,并间隔一定时间发送******************************************/
var xlsx = require('node-xlsx');
    var list = xlsx.parse('C:/Users/buxy__000/Desktop/node-serialport/log/fail_record.xlsx');
    console.log(list);
    // var maxRow = list[0].data.length;//行数
    // var col_id = 2;
    // var col_factory = 3;
    // var i = 1;
    // for(var j = 1;j < 11;j++) {  //获取所有表具信息，装入数组res_arr
    //     console.log(list[0].data[3][2] + list[0].data[3][4]);
    // }
