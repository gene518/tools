#!/bin/bash
##jin
##收集gpu时间、显存、温度、使用率等
##第一个入参解析文件、显卡一名称、显卡二名称

fileName=$(date +%Y%m%d%H%M)
echo $fileName
echo $1
mkdir $fileName
cd $fileName

time=${fileName}"shijian.log"
xiancun1=${fileName}"xiancun1.log"
xiancun2=${fileName}"xiancun2.log"
gpu1Use=${fileName}"gpu1Use.log"
gpu2Use=${fileName}"gpu2Use.log"
wendu1=${fileName}"wendu1.log"
wendu2=${fileName}"wendu2.log"
gupInfo="00000"${fileName}"gpuInfo.log"

echo "时间" > $time
echo "第一张卡显存(MiB)" > $xiancun1
echo "第二张卡显存(MiB)" > $xiancun2
echo "第二张卡gpu使用率(%)" > $gpu1Use
echo "第二张卡gpu使用率(%)" > $gpu2Use
echo "第二张卡温度(C)" > $wendu1
echo "第二张卡温度(C)" > $wendu2


cat ../$1 |grep -i 2021|awk -F ' ' {'print $3,$4'} >> $time
cat ../$1 |grep -i -A 2 $2|grep -i mib|awk -F '|' {'print $3'}|awk -F '/' {'print $1'} | sed 's/MiB//g' >> $xiancun1
cat ../$1 |grep -i -A 2 $3|grep -i mib|awk -F '|' {'print $3'}|awk -F '/' {'print $1'} | sed 's/MiB//g' >> $xiancun2
cat ../$1 |grep -i -A 2 $2|grep -i %|awk -F '|' {'print $4'}|awk -F ' ' {'print $1'} | sed 's/%//g' >> $gpu1Use
cat ../$1 |grep -i -A 2 $3|grep -i %|awk -F '|' {'print $4'}|awk -F ' ' {'print $1'} | sed 's/%//g' >> $gpu2Use
cat ../$1 |grep -i -A 2 $2|grep -i P0 |awk {'print $3'} | sed 's/C//g' >> $wendu1
cat ../$1 |grep -i -A 2 $3|grep -i P0 |awk {'print $3'} | sed 's/C//g' >> $wendu2

paste $time $xiancun1 $xiancun2 $gpu1Use $gpu2Use $wendu1 $wendu2> $gupInfo

echo "结果请查看文件夹："${fileName}"中的："${gupInfo}"文件"