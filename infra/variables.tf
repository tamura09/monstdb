variable "vercel_api_token" {
  description = "Vercel API token (https://vercel.com/account/tokens)"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team/org ID. Leave empty if the project lives under a personal account."
  type        = string
  default     = ""
}

variable "database_url" {
  description = "DATABASE_URL used by the app in production/preview"
  type        = string
  sensitive   = true
  default     = ""
}
