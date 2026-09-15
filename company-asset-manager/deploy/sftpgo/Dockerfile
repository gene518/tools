FROM scratch

COPY build/rootfs/ /
COPY locales/zh-CN/translation.json /usr/share/sftpgo/static/locales/zh-CN/translation.json
COPY templates/common/base.html /usr/share/sftpgo/templates/common/base.html

WORKDIR /var/lib/sftpgo
USER 1000:1000
ENV SFTPGO_LOG_FILE_PATH=""

ENTRYPOINT ["/usr/bin/sftpgo"]
CMD ["serve"]
