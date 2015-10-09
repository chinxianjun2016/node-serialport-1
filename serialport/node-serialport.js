var SerialPort = require("serialport"); //引入串口模块
var ejsExcel = require("ejsexcel");    //引入按照模板创建excel文件的模块
var iconv = require('iconv-lite');  //引入数据编码格式转换模块
var http = require('http');   //引入http模块
var express = require('express'); //引入express模块
var sio = require('socket.io'); //引入socket.io模块
var app = express();  //创建express实例
var path = require('path');  //引入path模块
var fs = require('fs');  //引入fs模块
var xlsx = require('node-xlsx');//引入读取excel文件模块
var meter_command = require('./meter_code_protocol.js');//引入根据表号和生产厂家生成抄表指令的模块
var server = http.createServer(app);
server.listen(2212);//监听2212端口


app.use(express.static(path.join(__dirname, 'public'))); //设置public文件夹为静态资源文件夹,必须建立否则js和css无法加载
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/command_1.1.html');
});   //设置路由，当客户端请求'/'时，发送文件command.html
app.post('/command_1.1.html', function (req, res) {
    req.on("data", function (data) {
        res.send(data);
    });
});


var socket = sio.listen(server);

var rec_setting = '';  //接收编码方式
var send_setting = '';  //发送编码方式
var send_times = 0;  //记录页面点击发送的次数
var sp;  //定义一个全局变量，接收创建的端口
//监听connection事件
socket.on('connection', function (socket) {
    console.log('与客户端的命令连接通道已经建立');

    SerialPort.list(function (err, ports) {
        ports.forEach(function (port) {
            //console.log(port.comName);
            serials_to_web(port.comName);
        });
    });
    /************************************获取串口配置信息*************************************/
    socket.on('serial_info', function (data)  //获取串口信息
        {
            com_num = data.com_num;  //串口号
            baudrate = parseInt(data.baudrate);  //波特率
            databits = parseInt(data.databits);  //数据位
            stopbits = parseInt(data.stopbits);  //停止位
            parity = data.parity;                //校验
            serial_flag = data.serial_flag;   //串口状态标志位


            if (serial_flag == "close") {
                if ((typeof sp) != 'undefined') {
                	if(sp.isOpen())
                	{
                		sp.close(function (err) {
                        if (err) throw err;
                        else {
                            console.log('串口已经关闭');
                            data_to_web('串口已经关闭');
                        }
                    });
                	}
                }
            }
        }
    );
//说明：串口实现可以重复打开关闭的思路是：如果关闭串口按钮按下，推送串口信息（起始只需要推送串口状态标志位就可以了）到服务器，服务器判断串口信息，
// 如果是关闭串口的操作的话，sp.close()来关闭串口连接，同时更改上一次打开的串口的串口号（这个串口号必须要改，否则没办法继续下一次打开关闭串口的操作），
// 更改了上次打开的串口号之后，下次打开串口直接重新开一个端口就可以了，这样就不会出现'Eroor:SerialPort is not open'的错误了。
    socket.on('meterReading', function (data) {
        //监听meterReading事件 获取数据
        send_times++;
        file_path = data.file_path.replace(/\\/g, "\/");  //替换‘\’为‘/’  //文件路径
        serial_file_opr = data.serial_file_opr;   //是否按照文件抄表
        rec_setting = data.rec_setting;           //接收编码
        send_setting = data.send_setting;         //发送编码
        if (data.auto_time != "")  //如果发送时间为空，则发送时间为0
        {
            auto_time = parseInt(data.auto_time);
        }
        else {
            auto_time = 0;
        }
        auto_send = data.auto_send;     //是否自动抄表
        meterid = data.meterid;         //表号
        type = data.type;                //表的品牌
        command = data.command;        //抄表指令
     //   console.log(rec_setting);

        send_juge();

        if(send_times ==1)  //当页面第一次进行数据发送时，就打开监听，此后监听就一直开启，不应该多次打开，打开一次就够了
        {
            socket.on('disconnect', function () {
                //监听disconnect事件
                console.log('已经断开命令通道连接！');
            });
            socket.on('error', function (err) {
                if (err) {
                    console.log(err);
                }
            })
        }
    });

    //接收编码的更改
    socket.on('encode_setting', function (data) {
        rec_setting = data.rec_setting;           //接收编码
        send_setting = data.send_setting;         //发送编码
    });
});

/***************************读取excel中的数据,并间隔一定时间发送******************************************/
//说明：file_path : excel文件路径; row_start : 从哪一行开始读；
//     col_id : 表号数据所在列    col_factory ： 生产厂家所在列
//注意：行和列都是从0开始计算
var write_time = 0;
function read_excel(file_path, row_start, col_id, col_factory) {
    var list = xlsx.parse(file_path);
    var maxRow = list[0].data.length;//行数
    var i = row_start;
    loop();
    function loop() {
        if (i < maxRow) {
            var send_command_xls = meter_command.get_command(list[0].data[i][col_id].toString(), list[0].data[i][col_factory].toString()).res_command;
            serial_read_write(send_command_xls, 0);
            i++;
            if (auto_time == 0)      //如果没有设置自动发送的时间间隔，默认一秒发送一条
            {
                setTimeout(function () {
                    loop();
                }, 1000);
            }
            else {
                setTimeout(function ()  //如果设置了发送间隔，按照用户设置的时间发送
                {
                    loop();
                }, auto_time);
            }
        }
        else if(find_fail() != []){  //如果抄表失败表具不为0，则再次针对抄表失败的表具进行抄表操作。
                loop_2(find_fail());  //调用抄表函数
        }

    }
/**********************************************针对失败的表具进行补抄*****************************************************/
    var i_index = 0;

    function loop_2(datas) {
        if (i_index < datas.length) {
            var send_command_arr = meter_command.get_command(datas[i_index].toString(), datas[i_index + 1].toString()).res_command;
            serial_read_write(send_command_arr, 0);
            i_index = i_index + 2;
            if (auto_time == 0)      //如果没有设置自动发送的时间间隔，默认一秒发送一条
            {
                setTimeout(function () {
                    loop_2(datas);
                }, 1000);
            }
            else {
                setTimeout(function ()  //如果设置了发送间隔，按照用户设置的时间发送
                {
                    loop_2(datas);
                }, auto_time);
            }
        }
        else{
            writeXls(find_fail());
        }
    }
}

/*************************************推送接收的数据到网页页面*************************************/
function data_to_web(rec_data) {
    socket.emit('data_to_web', rec_data);   //‘发送’ data_to_web 事件
}

/******************************************推送串口信息到网页页面*************************************/
function serials_to_web(data) {
    socket.emit('serials_to_web', data);
}


/*********************************串口数据发送和接收***********************************************/
function serial_read_write(write_data, auto_send_time)    //串口操作
{
    if (serial_flag != 'close') {
        //sp是用来记录创建的serialPort的
        if ((typeof sp) != 'undefined') {
            if (sp.isOpen()) {
                if (sp.path != com_num)  //sp有数据，且sp记录打开的串口号和即将创建的串口号不同
                {
                    //sp.close(function (err) {
                    //    if (err) throw err;
                    //});
                    open_serial();  //打开端口
                    open_wr(); //新创建的端口必须要先打开端口（sp.on('open',callback)）才能进行数据读写
                }
                else {
                    if(send_times ==1) //第一次进行发送，此时打开读写同时打开监听
                    {
                        write_read(); //端口已经创建，直接读写就可以，因为上一次创建端口时已经打开了端口，若此时继续打开端口，sp.on（'open',callback）内部的代码不会执行
                    }
                    else   //已经打开读监听了，如果继续打开，发送多次之后会出现“(node) warning: possible EventEmitter memory leak detected. 11 data listeners added. Use emitter.setMaxListeners() to increase limit.”的警告
                    //所以此时不需要再次打开监听，只需要进行数据发送就可以了。
                    {
                        serial_write();
                    }
                }
            }
            else {
                open_serial();  //打开端口
                open_wr();
            }
        }
        else   //sp没有数据，则直接打开串口
        {
            open_serial();
            open_wr();
        }
    }
    /************************************打开串口并读写数据*********************************/
    function open_wr() {
        sp.on("open", function (err) {
            if (err) {
                console.log(err + "打开串口出错，请重试");
            }
            else {
                console.log('串口已经打开');
                serial_write();
                serial_read();
            }
        });
    }

    /*****************************************读写数据***************************************/
    function write_read() {
       serial_read();
        serial_write();
    }
/*******************************************读串口****************************************/
    function serial_read()
    {
        sp.on('data', function (info) {
                console.log('data_change:' + iconv.decode(info, rec_setting));
                data_to_web(iconv.decode(info, rec_setting));
                data_to_web('接收数据字节长度：'+info.length);
                if (info.toString('hex') == 'e5')  //伟岸表具
                {
                    var buf_second = new Buffer('105BFD5816', send_setting);
                    sp.write(buf_second);
                    data_to_web('发送数据：105BFD5816');
                }
                if (file_path != '') {
                    data_analy(info.toString('hex'));//数据分析
                }
        });
    }
/********************************************写串口***********************************/
    function serial_write()
    {
        var buf_once = new Buffer(write_data, send_setting);
        sp.write(buf_once, function (err, results) {
            if (err) {
                console.log('err ' + err);
            }
            else {
                data_to_web('发送数据：'+write_data.toLocaleUpperCase());
                data_to_web('发送数据字节长度： ' + results);
                console.log('发送数据字节长度： ' + results);  //发出去的数据字节长度
            }
        });
        if (auto_send_time != 0) {
            var autoSend =  setInterval(function () {
                if (serial_flag != 'close')  //如果串口关闭，停止自动发送
                {
                    var buf = new Buffer(write_data, send_setting);
                    console.log(buf);
                    sp.write(buf, function (err, results) {
                        if (err) {
                            console.log('err ' + err);
                        }
                        else {
                            data_to_web('发送数据：'+write_data.toLocaleUpperCase());
                            data_to_web('发送数据字节长度： ' + results);
                            console.log('发送数据字节长度： ' + results);  //发出去的数据字节长度
                        }
                    })
                }
                else
                {
                    clearInterval(autoSend)
                }

            }, auto_send_time);
        }
    }
    /**********************************创建串口***************************************/
    function open_serial() {
        var serialPort = new SerialPort.SerialPort(com_num, {
            baudrate: baudrate,  //波特率设置
            databits: databits,  //数据位
            parity: parity,  //校验位
            stopbits: stopbits //停止位
          //  parser: SerialPort.parsers.readline("\r\n")
        });
        data_to_web('串口已经打开');
        sp = serialPort;
    }

    /**********************************创建串口***************************************/

}

/****************************************发送状态判断*******************************************/
function send_juge() {
    //命令手动发送条件：表号可以不管，条件一：有抄表命令，条件二：没有选择自动发送，条件三：文件发送选择否或者文件路径为空
    if (command != "" && auto_send == "auto_send_no" && ((serial_file_opr == "serial_file_stop") || (file_path == ""))) //发送命令手动抄表
    {
        serial_read_write(command, 0);
    }
    //命令自动发送条件：表号可以不管，条件一：有抄表命令，条件二：选择自动发送，条件三：发送时间不为0，条件四：文件发送选择否或者文件路径为空
    //因为最页面输入时，如果选择自动发送，则抄表间隔时间肯定不为0，所以这里就不用判断这个条件
    if (command != "" && auto_send == "auto_send_yes" && ((serial_file_opr == "serial_file_stop") || (file_path == ""))) //定时自动抄表
    {
        serial_read_write(command, auto_time);
    }
    //文件自动发送条件：条件一：文件路径不为空，条件二：选择文件自动发送     //优先级最高，只要这两项满足，其他的条件都不管，直接文件发送
    if (file_path != "" && (serial_file_opr == "serial_file_start"))  //文件发送
    {
        fs.exists(file_path, function (exists) {  //判断文件或者路径是否存在，存在返回true，否则返回false
            if (exists == false) {
                console.log("请检查文件路径是否正确");
                data_to_web("请检查文件路径是否正确");
            }
            else {
                read_excel(file_path, 1, 1, 2);
            }
        });
        // serial_read_write();  //命令来自excel文件解析的结果，时间间隔1000ms
    }
    //按表号手动发送条件：条件一：有表号，条件二：抄表指令为空，条件三：文件发送选择否或者文件路径为空，条件四：自动发送选择否
    if (command == "" && (meterid != "") && (auto_send == "auto_send_no") && ((serial_file_opr == "serial_file_stop") || (file_path == "")))//按表号手动抄表
    {
        var send_command = meter_command.get_command(meterid, type).res_command; //发送抄表指令（伟岸表还需要下一步操作）
        serial_read_write(send_command, 0);  //命令来自表号及表类型解析的结果，发送间隔为0
    }
    //按表号自动发送条件：条件一：有表号，条件二：抄表指令为空，条件三：文件发送选择否或者文件路径为空，条件四：自动发送选择是，条件五：抄表时间不为0
    //因为最页面输入时，如果选择自动发送，则抄表间隔时间肯定不为0，所以这里就不用判断这个条件
    if (command == "" && (meterid != "") && (auto_send == "auto_send_yes") && ((serial_file_opr == "serial_file_stop") || (file_path == "")))//按表号自动抄表
    {
        var send_command_id = meter_command.get_command(meterid, type).res_command;
        serial_read_write(send_command_id, auto_time);  //命令来自表号及表类型解析的结果
    }
}

/****************************************对抄收的数据进行数据解析***********************************/
var rec_data = [];
var ID_count = 0;
function data_analy(data) {
    data = data.toLocaleUpperCase();

    //接收的有效数据长度  68-16之间的数据
    //var ruina_data_len = 114;  //瑞纳
    //var tiangang_data_len = 114;  //天罡
    //var huizhong_data_len = 114;  //汇中
    var data_len = 114;    //瑞纳、天罡、汇中、迈拓
    var weian_data_len = 118;   //伟岸

    //前导符
    var len_str_temp = 'FEFE68';  //瑞纳、天罡、汇中、迈拓通用前导符
    var len_str = 'FEFEFEFE68';  //瑞纳、天罡
    var len_str_weian = '68';   //伟岸

    //结束标志位
    var end_bit = '16';
    var reg_temp = new RegExp(len_str_temp + "(\\S{" + data_len + "})" + end_bit, "gi");
    var reg_RT = new RegExp(len_str + "(\\S{" + data_len + "})" + end_bit, "gi"); //114
    var reg_MH = new RegExp(len_str_temp + "(\\S{" + data_len + "})" + end_bit, "gi"); //114
    var reg_weian = new RegExp(len_str_weian + "(\\S{" + weian_data_len + "})" + end_bit, "gi");  //118

    //进行有效数据位匹配
    if (reg_temp.test(data))  //瑞纳、天罡、汇中、迈拓
    {
        //获取表号
        if (reg_RT.test(data))  //瑞纳、天罡
        {
            var temp_data = data.split(len_str)[1]; //获取前导符后面的有效数据
            var meter_id = temp_data.slice(2, 16);  //获取表号(除了伟岸，其他四种表具都适用)
            var meter_addr = reverse(meter_id.slice(0, 8));

            var ruina_tiangang_id = /001111/gi;   //瑞纳、天罡表号保留位为001111

            if (ruina_tiangang_id.test(meter_id)) {
                rec_data[ID_count + 1] = meter_id_find(meter_addr, file_path);  //记录表生产厂家
                rec_data[ID_count + 2] = meter_addr;  //记录表号,8位，反转
            }
            else {
                rec_data[ID_count + 2] = '该数据有误，表号格式不正确';
            }

            rec_data[ID_count] = data;  //记录数据

            rec_data[ID_count + 3] = meter_id_comp(meter_addr, file_path);  //读取数据标志位
            ID_count = ID_count + 4;
        }
        else if (reg_MH.test(data))  //汇中、迈拓,表号不反转
        {
            var temp_data_MH = data.split(len_str_temp)[1];
            var meter_id_MH = temp_data_MH.slice(2, 16);
            var reg_huizhong_id = /FF(\S{2})F/gi;  //汇中表号保留位为FFFFF
            var reg_maituo_id = /001111/gi;  //迈拓表号保留位为001111
            var huizhong_id = meter_id_MH.slice(5);
            var maituo_id = meter_id_MH.slice(0, 8);
            if (reg_huizhong_id.test(meter_id_MH)) {
                rec_data[ID_count + 1] = 'hui_zhong'; //记录表的生产厂家
                rec_data[ID_count + 2] = huizhong_id;  //记录表号,9位，不反转
                rec_data[ID_count + 3] = meter_id_comp(huizhong_id, file_path);  //读取数据标志位
            }
            else if (reg_maituo_id.test(meter_id_MH)) {
                rec_data[ID_count + 1] = 'mai_tuo'; //记录表的生产厂家
                rec_data[ID_count + 2] = maituo_id;  //记录表号,8位，不反转
                rec_data[ID_count + 3] = meter_id_comp(maituo_id, file_path);  //读取数据标志位
            }
            else {
                rec_data[ID_count + 2] = '该数据有误，表号格式不正确';//表号不正确
            }

            rec_data[ID_count] = data;  //记录数据
            ID_count = ID_count + 4;
        }
    }
    if (reg_weian.test(data))  //伟岸的表
    {
        var index = data.indexOf('68') + 2;
        var temp_data_weian = data.slice(index);    //伟岸的需要提取的有效数据
        var meter_id_weian = reverse(temp_data_weian.slice(12, 20));
        var weian_true_id = meter_id_weian.slice(0, 2) + '02' + meter_id_weian.slice(2, 8);
        rec_data[ID_count] = data;  //记录数据
        rec_data[ID_count + 1] = 'wei_an'; //记录表的生产厂家
        rec_data[ID_count + 2] = weian_true_id;  //记录表号,8位，反转
        rec_data[ID_count + 3] = meter_id_comp(weian_true_id, file_path);  //读取数据标志位
        ID_count = ID_count + 4;
    }
  //  console.log(rec_data)
}

/*******************************字符两两反转********************************************/
function reverse(str) {
    var res = "";
    var temp_elem = "";
    var temp = "";
    for (var i = 0; i < str.length; i++) {
        if (i % 2 == 0) {
            temp_elem = str[i + 1] + str[i];  //因为是字符串形式所以直接进行拼接
            temp += temp_elem;
        }
    }
    for (var j = 0; j < str.length; j++) {
        res += temp[str.length - 1 - j];    //翻转整个字符串
    }
    return res;
}

/********************************查找Excel表格找表号对应的生产厂家*************************/
function meter_id_find(meter_id, file_path) {
    var list = xlsx.parse(file_path);
    var maxCol = list[0].data[0].length;//列数
    var maxRow = list[0].data.length;//行数

    var meter_producer = '';

    for (var j = 1; j < maxRow; j++) {
        if (meter_id == list[0].data[j][1]) {
            meter_producer = list[0].data[j][2];
        }
    }
    return meter_producer;
}

/*******************************标记数据抄收正确的表具********************************************/
//返回读表是否成功，标志位
var count_success = []; //记录成功的表号在excel文件中的位置
function meter_id_comp(id, file_path) {
    var list = xlsx.parse(file_path);
    var maxRow = list[0].data.length;//行数

    var res = [];
    var tem_index = 0;


    for (var j = 1; j < maxRow; j++) {
        res[tem_index] = list[0].data[j][1];
        res[tem_index + 1] = list[0].data[j][2];
        tem_index = tem_index + 2;
    }
    var read_success = '读表失败';
    for (var i = 1; i < maxRow; i++) {
        if (id == list[0].data[i][1]) {
            read_success = '读表成功';
            var success_index = count_success.length; //count_success不断增加
            count_success[success_index] = i;  //记录成功抄表的表号所在行
        }
    }
 //   console.log(count_success);
    return read_success;
}
/*******************************找出数据抄收出错的表号和生产厂家********************************************/
function find_fail() {
    var list = xlsx.parse(file_path);  //加载表具信息的excel表
    var maxRow = list[0].data.length;//行数
    var res_arr = [];
    var tem_index = 0;
    for (var j = 1; j < maxRow; j++) {  //获取所有表具信息，装入数组res_arr
        res_arr[tem_index] = list[0].data[j][1];
        res_arr[tem_index + 1] = list[0].data[j][2];
        tem_index = tem_index + 2;
    }
    for (var i = 0; i < count_success.length; i++) //将任务成功的表具信息删除，留下失败的表具信息
    {
        var temp = (count_success[i]) * 2 - 1;
        res_arr[temp - 1] = '';
        res_arr[temp] = '';
    }
    /***************************************************************/
    //将res_arr的空白项删除
    var len = res_arr.length;
    var data = [];
    var data_index = 0;
    for (var k = 0; k < len; k++) {
        if (res_arr[k] != '') {
            data[data_index] = res_arr[k];
            data_index++;
        }
    }
    return data;
}

//生成excel文件存储数据
function writeXls(datas) {

    var meter_maker = ['瑞纳','天罡','汇中','伟岸','迈拓'];
    var meter_maker_index;
    var len = datas.length;
    var list = xlsx.parse(file_path);  //加载表具信息的excel表
    var maxRow = list[0].data.length - 1;//表具数据的实际行数
    var exlBuf = fs.readFileSync("./fail_record_templet.xlsx"); //获取excel文件的格式模板

    var data_res = [];
    var data = [];
    for (var i = 0; i < len;) {
        switch(datas[i+1])
        {
            case 'rui_na':meter_maker_index = 0;break;
            case 'tian_gang':meter_maker_index = 1;break;
            case 'hui_zhong':meter_maker_index =2;break;
            case 'wei_an':meter_maker_index = 3;break;
            case 'mai_tuo':meter_maker_index =4;break;
            default :break;
        }
        data[i] = {'meterid': datas[i], 'meterpr': meter_maker[meter_maker_index], 'date': new Date().toLocaleString()};
        data_res = data_res.concat(data[i]);

        i = i + 2;
    }
    //记录抄表失败及成功的个数，并推送到网页显示
    var str_err = '抄表失败个数:' + data_res.length;
    var str_success = '抄表成功个数:' + (maxRow - data_res.length);
    console.log(str_success);
    console.log(str_err);
    data_to_web(str_success);
    data_to_web(str_err);

    //数据源
    var data_acc = [[], data_res];

    //用数据源(对象)data渲染Excel模板
    ejsExcel.renderExcelCb(exlBuf, data_acc, function (exlBuf2) {
        fs.writeFileSync("../log/fail_record.xlsx", exlBuf2);
    });
}