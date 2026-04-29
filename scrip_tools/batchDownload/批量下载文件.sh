#!/bin/bash
#参数1是下载文件内容、参数2是指定下载线程数

# 文件名
url_list_file=$1

# 检查URL列表文件是否存在
if [ ! -f "$url_list_file" ]; then
    echo "$url_list_file 不存在."
    exit 1
fi

# 设置并行下载的线程数
num_threads=$2

# 创建一个目录来存储下载的图片    
output_dir="downloaded_images"
mkdir -p "$output_dir"

# 使用xargs和wget多线程下载图片
#没有wget命令
#cat "$url_list_file" | xargs -n 1 -P "$num_threads" wget -P "$output_dir"
# cat "$url_list_file" | xargs -n 1 -P "$num_threads" -I {} sh -c 'curl -o "$download_dir/$output_dir/$(basename {}).jpg" "{}"'
# echo "$output_dir/jpg"
 
cat "$url_list_file" | xargs -n 1 -P "$num_threads" -I {} sh -c 'curl -o '"$output_dir"'/$(basename {}).jpg "{}"'

echo "Download complete. Images are saved in the $output_dir directory."
