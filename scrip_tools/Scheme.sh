#!/bin/bash

name="nick"
rnd=$(date +%s%N)
rnd2=$(date +%s%N)

echo $rnd
echo $rnd2

args="pajk2://video2?pattern=$1&roomId=$2&password=$2pajk&doctorId=$rnd&doctorName=$name$rnd2"

echo $args

start /d/JuphoonPackage/JuphoonPlugin.exe $args

