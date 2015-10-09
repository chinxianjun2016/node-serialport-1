/**
 * Created by xianyan.bu on 2015/9/15.
 */
/**
 * 功能：根据表号和品牌生成相应的抄表指令
 * @param meter_code
 * @param meter_brand
 * @returns {string}
 */
exports.get_command = function get_command(meter_code,meter_brand)
{
    var meter_change = "";  //记录翻转后的表号
    var  temp_command ="";  //暂存的抄表指令
    var data_cs = "";       //检验位
    var res_command = '';   //抄表指令
    var res_command_weian = '';//伟岸抄表指令
    //注：伟岸需要两条指令来完成抄表，第一条：根据表号下发指令，得到返回值后开始下发第二条读数据的指令：105BFD5816
    if(meter_brand == "rui_na")
    {
        //表号翻转，保留位在后，保留位00 11 11，表号为8位
        if(meter_code.length != 8)
        {
            console.log('瑞纳表号长度不正确，请重新确认表号是否正确！');
        }
        else
        {
            meter_change = reverse(meter_code);
            temp_command = 'FEFEFE6820' + meter_change + '00111101031F9000';
            data_cs = get_cs(temp_command.slice(6)).slice();
            res_command = temp_command + data_cs + '16';
        }
    }
    else if(meter_brand == "tian_gang")
    {
        //表号翻转，保留位在后，保留位00 11 11，表号为8位
        if(meter_code.length != 8)
        {
            console.log('天罡表号长度不正确，请重新确认表号是否正确！');
        }
        else
        {
            meter_change = reverse(meter_code);
            temp_command = 'FEFEFE6820' + meter_change + '00111101031F9000';
            data_cs = get_cs(temp_command.slice(6)).slice();
            res_command = temp_command + data_cs + '16';
        }
    }
    else if(meter_brand == 'mai_tuo')
    {//表号不反转,保留位在后，保留位00 11 11，表号8位
        if(meter_code.length != 8)
        {
            console.log('迈拓表号长度不正确，请重新确认表号是否正确！')
        }
        else
        {
            temp_command = 'FEFEFE6820' + meter_code + '0011110103901F00';
            data_cs = get_cs(temp_command.slice(6)).slice();
            res_command = temp_command + data_cs + '16';
        }
    }
    else if(meter_brand == 'hui_zhong')
    {
        //表号不反转,保留位在前,保留位为全F,表号9位
        if(meter_code.length != 9)
        {
            console.log('汇中表号长度不正确，请重新确认表号是否正确！')
        }
        else
        {
            temp_command = 'FEFEFE6820FFFFF' + meter_code + '0103901F0B';
            data_cs = get_cs(temp_command.slice(6)).slice();
            res_command = temp_command + data_cs + '16';
        }
    }
    else if(meter_brand == 'wei_an')
    {
        //表号翻转，表号10位，发8位
        if(meter_code.length != 10)
        {
            console.log('伟岸表号长度不正确，请重新确认表号是否正确！')
        }
        else
        {
            var temp_meter_code = meter_code.slice(0,2) + meter_code.slice(4);
            meter_change = reverse(temp_meter_code);
            temp_command = '680B0B6853FD52' + meter_change + '295C0104';
            data_cs = get_cs(temp_command.slice(8)).slice();
            res_command = temp_command + data_cs + '16';
            res_command_weian = '105BFD5816';
        }
    }
    return{
        res_command : res_command,
        res_command_weian : res_command_weian
    };
};


//字符串翻转，两两（1个字节）逆序排列
//说明：这里的字符串翻转并不是逐个的逆序排列，是两两的逆序排列。
//      也就是说一个字节的数据是不允许发生变换的，否则就会改变它的真实数值。
//      所以，这里首先要给一个字节的数据进行翻转，然后逐个地逆序排列整个字符串，这样变换的结果才是我们想要的结果
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

//校验和计算
function get_cs(data)
{
    var res = 0;
    for(var i=0;i<data.length;i++)
    {
        if(i%2 == 0)
        {
            var temp = parseInt((data[i] + data[i+1]),16);
            res += temp;
        }
    }
    var result = res.toString(16).toLocaleUpperCase(); //整数转换成16进制字符串显示，并且转换成大写
    return result.slice(result.length-2);  //取低两位
}
//console.log(get_command('31451087','rui_na'));
//console.log(get_command('121212126','hui_zhong'));
//console.log(get_command('21620844','mai_tuo'));