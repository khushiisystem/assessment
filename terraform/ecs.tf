# ECR Repositories
resource "aws_ecr_repository" "frontend" {
  name         = "my-app-frontend"
  force_delete = true
}

resource "aws_ecr_repository" "backend" {
  name         = "my-app-backend"
  force_delete = true
}

resource "aws_ecr_repository" "mysql" {
  name         = "my-app-mysql"
  force_delete = true
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "my-app-cluster"
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_task_role" {
  name = "ecs-task-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_policy" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "ecs_task_cloudwatch_policy" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

# IAM Role for EC2 ECS Instances
resource "aws_iam_role" "ecs_ec2_role" {
  name = "ecs-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_ec2_policy" {
  role       = aws_iam_role.ecs_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_profile" {
  name = "ecs-ec2-profile"
  role = aws_iam_role.ecs_ec2_role.name
}

# EC2 Launch Template
resource "aws_launch_template" "ecs_lt" {
  name_prefix   = "ecs-ec2-"
  image_id      = "ami-0deec649e05b19cb2"
  instance_type = "t3.small"

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ecs_sg.id]
  }

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_profile.name
  }

  user_data = base64encode(<<-EOF
#!/bin/bash
echo ECS_CLUSTER=my-app-cluster >> /etc/ecs/ecs.config
echo ECS_ENABLE_TASK_IAM_ROLE=true >> /etc/ecs/ecs.config
EOF
  )
}

# Auto Scaling Group
resource "aws_autoscaling_group" "ecs_asg" {
  desired_capacity    = 2
  min_size            = 1
  max_size            = 3
  vpc_zone_identifier = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  launch_template {
    id      = aws_launch_template.ecs_lt.id
    version = "$Latest"
  }
}

# Frontend Task Definition
resource "aws_ecs_task_definition" "frontend" {
  family                   = "frontend-task"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([{
    name  = "frontend"
    image = "${aws_ecr_repository.frontend.repository_url}:latest"
    portMappings = [{
      containerPort = 80
      hostPort      = 80
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/frontend-task"
        "awslogs-region"        = "ap-southeast-1"
        "awslogs-stream-prefix" = "ecs"
        "awslogs-create-group"  = "true"
      }
    }
  }])
}

# Backend + MySQL Combined Task Definition
resource "aws_ecs_task_definition" "backend" {
  family                   = "backend-task"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "768"
  memory                   = "1536"
  execution_role_arn       = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "mysql"
      image = "mysql:8.0"
      portMappings = [{
        containerPort = 3306
        hostPort      = 3306
      }]
      environment = [
        { name = "MYSQL_ROOT_PASSWORD", value = "rootpassword" },
        { name = "MYSQL_DATABASE",      value = "ecommerce" },
        { name = "MYSQL_USER",          value = "djangouser" },
        { name = "MYSQL_PASSWORD",      value = "djangopass" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/mysql-task"
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group"  = "true"
        }
      }
    },
    {
      name  = "backend"
      image = "${aws_ecr_repository.backend.repository_url}:latest"
      portMappings = [{
        containerPort = 8000
        hostPort      = 8000
      }]
      links = ["mysql:mysql"]
      environment = [
        { name = "SECRET_KEY",             value = "QdmVRKh8ObhMIU1Q16EFpfJt9z4wa92ZX0VBnMEYkfQbhUwzebgo1IkmBzTCZuhM8C8" },
        { name = "DEBUG",                  value = "True" },
        { name = "DJANGO_SETTINGS_MODULE", value = "djecommerce.settings.development" },
        { name = "DB_HOST",                value = "mysql" },
        { name = "DB_NAME",                value = "ecommerce" },
        { name = "DB_USER",                value = "djangouser" },
        { name = "DB_PASSWORD",            value = "django" },
        { name = "DB_PORT",                value = "3306" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/backend-task"
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])
}

# Frontend ECS Service
resource "aws_ecs_service" "frontend" {
  name            = "frontend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "EC2"
}

# Backend ECS Service
resource "aws_ecs_service" "backend" {
  name            = "backend-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "EC2"
}
