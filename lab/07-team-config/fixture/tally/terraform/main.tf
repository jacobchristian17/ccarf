terraform {
  backend "s3" {
    bucket = "tally-tfstate"
    key    = "prod/terraform.tfstate"
    region = "ap-southeast-1"
  }
}

resource "aws_db_instance" "tally" {
  identifier        = "tally-prod"
  engine            = "postgres"
  instance_class    = "db.t4g.medium"
  allocated_storage = 50
}
