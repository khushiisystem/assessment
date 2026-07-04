```
Judge0 API Servers
Ubuntu 22.04 LTS Deployment Guide

Overview: This document explains the setup of the Judge0 API Server using Terraform and an automated user-data shell script that configures:

1. GRUB Configuration
Adds systemd.unified_cgroup_hierarchy=0
Runs update-grub to apply settings


2. Nginx Configuration
Installs Nginx
Sets up reverse proxy for Judge0 API (port 2358)
Validates configuration
Enables & restarts Nginx


3. Docker Installation
Removes old Docker packages
Adds official Docker repository
Enables Docker service
Adds ubuntu user to docker group


4. Judge0 API Setup
Downloads Judge0 release zip
Extracts it
Generates secure Redis/Postgres passwords
Updates config files
Creates systemd service judge0.service
Starts Judge0 using Docker Compose


5. Reboot
Reboots the EC2 instance after all configurations are complete


Judge0 API Setup Using Terraform
The entire infrastructure and Judge0 setup are automated using Terraform.
Refer to the Terraform configuration files (and main.tf and judge0-userdata-script.sh) for provisioning logic.

Prerequisites:
AWS CLI   → check: aws sts get-caller-identity
Terraform → check: terraform --version

Steps to Deploy
git clone -b judge0-terraform <repo-url>
cd <repo>

terraform init
terraform validate
terraform plan
terraform apply --auto-approve

Destroy Infrastructure (when needed)
terraform destroy

Terraform Output Variables
Terraform will provide debug-friendly outputs:

ssh_command
instance_id
public_ip


Use these for troubleshooting or connecting to the EC2 instance.

Testing the Installation
1. Submit Code for Execution
curl -X POST http://<public-ip>/submissions \
-H "Content-Type: application/json" \
-d '{"language_id":71,"source_code":"print(\"Hello from Python!\")"}'


You will receive a JSON response containing a token.

2. Check Submission Result
curl http://<public-ip>/submissions/<token>?base64_encoded=false


Final Step

After provisioning the Judge0 API instance, update the public IP inside the .env file of the TranningAndCertification repository on your Assessment Deployment Server:

JUDGE0_API_URL=http://<public-ip>/
```
