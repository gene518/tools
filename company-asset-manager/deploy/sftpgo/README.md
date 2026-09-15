# SFTPGo deployment

This service runs the verified SFTPGo `v2.7.5` Debian release inside a local Docker image. The deployed package SHA-256 is `05997f84cc7b0d4b0b21777b56468c727168c6a40fa9eb17dd9ce4a9e1e0f1b6`. It joins the existing `company-assets_default` network and uses its PostgreSQL service through the `db` network alias.

Runtime secrets belong in `sftpgo.local.env`, which is intentionally ignored by Git. Persistent files are in `data/`; SFTPGo metadata is stored in the dedicated `sftpgo` PostgreSQL database.

The upstream `zh-CN` translation is bundled as a local overlay from commit `7e1e2688628b61b2d1b5d454264e8e814dc41390`; its SHA-256 is `b32ca568b3e375965ddbfd1a4e6534867790271652987ad630a137fe623c9226`. The release template is patched to recognize `zh-CN` and retain its full locale code while loading translation assets, and the service is configured to use Chinese by default.

The public administrator entry is `https://124.221.244.227/files/web/admin`. Run `bash /home/ubuntu/sftpgo/backup.sh` on the server to create and verify a backup of the database, files, and runtime configuration.
