---
title: Getting Started
description: Learn how to install, configure, and start using Maillayer for your email marketing needs.
order: 1
---

# Complete Guide to Setting Up MailLayer on a VPS

MailLayer is a powerful open-source email marketing platform that you can self-host on your own VPS (Virtual Private Server). This guide walks you through the entire setup process, from deploying MailLayer on your server to configuring Amazon SES for reliable email delivery.

## Prerequisites

Before you begin, you'll need:

-   A MailLayer license
-   A GitHub account
-   A VPS (Digital Ocean, Hetzner, or similar)
-   A domain name for your MailLayer instance
-   An AWS account for Amazon SES

### Here is YouTube Video to Setup Maillayer

[![YouTube Video](https://c1.tablecdn.com/maillayer/get-started.png)](https://youtu.be/F0dXcw5f6ww)

## Part 1: Setting Up MailLayer on a VPS

### Getting a License

1. Go to the MailLayer pricing page and purchase a license
2. You'll receive an email to activate your account
3. Once activated, you'll get an invite to the GitHub repository
4. Accept the invitation and clone the repository to your GitHub account

### Setting Up Your VPS

For this guide, we'll use Digital Ocean, but you can use any VPS provider:

1. Create a new Droplet (VPS) with the following specifications:

    - Location: Choose a region close to your users (e.g., New York)
    - OS: Ubuntu 22.04
    - Plan: At least 2GB RAM (4GB recommended)

2. Once your VPS is created, note the IP address

3. Add a subdomain for your MailLayer instance:
    - Create an A record in your DNS settings: `coolify.yourdomain.com` & `mail.yourdomain.com` pointing to your VPS IP address

### Installing Coolify

Coolify is a self-hosted deployment platform (similar to Heroku) that we'll use to deploy MailLayer:

1. Access your VPS via the web console or SSH:

    ```
    ssh root@your-vps-ip
    ```

2. Install Coolify by running the installation command:

    ```
    curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
    ```

3. Wait for the installation to complete (usually takes about 60 seconds)

4. Now you can access the coolify with the public IP address of VPS your-vps-ip:8000.

5. Now setup a custom domain for this coolify `coolify.yourdomain.com` in the setting. After save restart server proxy.

### Connecting to GitHub

1. Create a project
2. Select "Private repository with GitHub apps"
3. Click "Add a GitHub app"
4. Click "Continue" and then "Register now"
5. Create GitHub app
6. Install the app on your GitHub account
7. Select the MailLayer repository you cloned earlier
8. Click "Install"

### Setting Up Required Databases

MailLayer requires Redis and MongoDB databases:

#### Setting up Redis:

1. Go to your projects dashboard
2. Select your MailLayer project
3. Click "New" under Resources
4. Search for "Redis"
5. Click on Redis and then "Start"
6. Copy the Redis URL and save it for later

#### Setting up MongoDB:

1. Go back to your MailLayer project
2. Click "New" under Resources again
3. Search for "MongoDB"
4. Click on MongoDB and then "Start"
5. Copy the MongoDB URL and save it for later

### Configuring Environment Variables

1. Go to your MailLayer application in Coolify
2. Go to Envirement Variables and Click on "Developer View"
3. Add the following environment variables:

    - `NODE_ENV`: `production`
    - `BASE_URL`: `https://mail.yourdomain.com` (your MailLayer domain)
    - `TRACKING_SECRET`: Choose a secure random string
    - `MONGODB_URL`: Paste the MongoDB URL you saved earlier
    - `REDIS_URL`: Paste the Redis URL you saved earlier
    - `NEXTAUTH_SECRET`: Choose another secure random string
    - `NEXTAUTH_URL`: Same as your BASE_URL

4. Click "Save all environment variables"

### Deploying MailLayer

1. Go back to the application overview
2. Click "Deploy"
3. Wait for the deployment to complete (this may take a couple of minutes)
4. Once deployed, visit your domain (e.g., `mail.yourdomain.com`)
5. Set up your admin account when prompted
6. Create your first brand (e.g., your company domain)

## Part 2: Configuring and Using MailLayer

### Setting Up Your AWS Credentials

To send emails through MailLayer, you need to connect it to Amazon SES:

1. Log in to your AWS Console
2. Navigate to Amazon SES to check your region (e.g., North Virginia)
3. Create IAM user for MailLayer:

    - Go to IAM service
    - Click "Users" → "Create user"
    - Give it a name (e.g., "maillayer")
    - Click "Next"
    - Select "Attach policies directly"
    - Search for and select both:
        - "AmazonSESFullAccess"
        - "AmazonSNSFullAccess"
    - Click "Next" → "Create user"

4. Generate access keys:

    - Click on the newly created user
    - Go to "Security credentials" tab
    - Scroll down to "Access keys"
    - Click "Create access key"
    - Select "Other" for the use case
    - Click "Next" → "Create access key"
    - Copy both the Access Key ID and Secret Access Key

5. In MailLayer, start the verification process:
    - Click on the verification button in your brand settings
    - Select the same AWS region as your SES account
    - Paste the Access Key ID and Secret Access Key
    - Click "Save" to validate the credentials

### Verifying Your Domain

To improve deliverability, you need to verify your domain with Amazon SES:

1. In MailLayer, click "Verify Domain"
2. You'll see DNS records that need to be added to your domain:

    - TXT record for domain verification
    - CNAME records for DKIM verification

3. Add these records to your domain's DNS settings
4. Wait a few minutes, then click "Check verification status"
5. Once verified, set up your sender details:

    - Sender name (e.g., "Your Company Name")
    - Email address (e.g., "hello@yourdomain.com")
    - Reply-to address (usually the same)

6. Click "Complete verification setup"

### Creating Campaigns

1. In MailLayer, navigate to "Campaigns"
2. Click "Create campaign"
3. Give your campaign a name
4. Use the drag-and-drop editor to design your email
5. Add content, images, and links as needed
6. Save your campaign

### Managing Contacts

1. Go to the "Contacts" section
2. Click "Create contact list"
3. You can add contacts:
    - Manually, one by one
    - By importing a CSV file

### Sending Your First Campaign

1. Open the campaign you want to send
2. Click "Send"
3. Select the contact list to send to
4. Click "Send now" to start the campaign
5. Monitor the campaign statistics:
    - Opens
    - Clicks
    - Deliveries
    - Bounces

## Troubleshooting

If you encounter issues during setup:

-   Make sure all environment variables are correctly set
-   Verify that your domain DNS records are properly configured
-   Check that your AWS credentials have the right permissions
-   Ensure your SES account is out of the sandbox mode if you're sending to non-verified recipients

---

By following this guide, you should have a fully functional MailLayer installation running on your own VPS and connected to Amazon SES for reliable email delivery. This setup gives you complete control over your email marketing campaigns while maintaining high deliverability rates.

If you still need help then write to us hello@maillayer.com
