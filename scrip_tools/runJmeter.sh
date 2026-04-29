#!/bin/bash
##jin
##执行jmeter
##需要配置jmeter环境变量

jmxFile=$1
reportFileFolder=$2

if [ -d $file ];then
  echo "文件夹存在"
else
  echo "文件夹不存在"
fi

if [ ! -d $reportFileFolder ];then
  mkdir /data
else
  echo "文件夹已经存在"
fi

sh jmeter.sh -n -t $jmxFile  -l $reportFileFolder &