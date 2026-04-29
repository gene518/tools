#!/bin/bash

if [ $# -lt 3 ];
then
    echo 'usage: sh test.sh $sourcefile $splitchar $splittotalnum'
    exit
fi
awk -F $2 '{if(NF=='$3') {print $0}}' $1 > valid.jtl
awk -F $2 '{if(NF!='$3') {print NR}}' $1 > invalid_line.txt