
TP LINK TL IPC43AN AI Verison 2.0 Faces Downloader Cli


A missed function from TP Link AI camera, and its backend function to download the faces only works IE! so create this script for quick to fetch the spefic date times period faces. 

The scipt is tested with TL-IPC43AN AI 2.0 only.
仅在TL-IPC43AN 300万AI云台无线网络摄像机测试过
TL-IPC43AN AI版

    Usage:

    node index.js --option=<argument>
    --start_time Start date time 开始时间
    --end_time Start date time   结束时间
    --minutes or fetch from minutes to now 或者按分钟回退提取图片，适合定期提取使用
    --host TP-Link Camera IP 摄像头IP地址，一般是局域网IP
    --http_port TP-Link Camera IP HTTP PORT default is 80/8080 摄像头端口 默认一般是80 
    --rtsp_port TP-Link Camera IP RTSP PORT default is 554 RTSP端口默认是554
    --upload_url Upload downloaded pictures to this server, file field is image 如果设置上传地址，当有新的脸部照片将会上传到指定服务器，字段名称 image