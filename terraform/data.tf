data "aws_instances" "ecs_instances" {
  filter {
    name   = "tag:aws:autoscaling:groupName"
    values = [aws_autoscaling_group.ecs_asg.name]
  }

  filter {
    name   = "instance-state-name"
    values = ["running"]
  }
}
