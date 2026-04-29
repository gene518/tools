#!/bin/bash
##jin
##读取文件

fileName=$1
wav=".wav"
echo $fileName
while IFS= read -r line; do
  echo "$line"
done < $fileName

# # 函数：修改文件名称
rename_file() {
    local old_name=$1
    local new_name=$2
    local extension=${old_name##*.}
    if [[ $old_name != *.* ]]; then
        extension=""
    fi
    new_name+=.${extension}
    echo $old_name
    echo $new_name
    # mv "$old_name" "$new_name$wav"
}
 
# 读取对应关系文件，并进行文件重命名
while IFS= read -r line; do
    old_name=$(echo $line | awk '{print $1}')
    new_name=$(echo $line | awk '{print $2}')
    rename_file "$old_name" "$new_name"
done < $fileName