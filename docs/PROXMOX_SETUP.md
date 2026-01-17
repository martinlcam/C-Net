# Proxmox Connection Setup Guide

This guide will help you set up the connection between C-Net and your Proxmox server.

## Prerequisites

- Access to your Proxmox web interface (usually `https://proxmox-host:8006`)
- Administrator or appropriate permissions to create API tokens

## Step 1: Create an API Token

1. **Log in to Proxmox Web Interface**
   - Navigate to `https://your-proxmox-host:8006`
   - Log in with your credentials

2. **Navigate to API Tokens**
   - In the left sidebar, click on **Datacenter**
   - Go to **Permissions** → **API Tokens**

3. **Create New Token**
   - Click **Add** or **Create API Token**
   - Fill in the following:
     - **User/Realm**: Select your user (e.g., `root@pam` or `user@pam`)
     - **Token ID**: Give it a descriptive name (e.g., `c-net-dashboard`)
     - **Comment**: Optional description (e.g., "C-Net Dashboard Access")
   - Click **Generate** to create the token

4. **Save the Token Secret**
   - **Important**: The token secret is shown only once. Copy it immediately!
   - Format: `user@realm!token-name=secret-uuid`
   - Example: `root@pam!c-net-dashboard=a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## Step 2: Set Required Permissions

The API token needs specific permissions to function properly. You can either:

### Option A: Use Existing User with Appropriate Permissions

If your user already has admin permissions, the token will inherit them.

### Option B: Create a Role with Specific Permissions

1. Go to **Datacenter** → **Permissions** → **Roles**
2. Create a new role (e.g., `c-net-role`)
3. Add the following privileges:
   - `Datastore.Audit` - View storage information
   - `Sys.Audit` - View system information
   - `VM.Monitor` - Monitor VM status
   - `VM.PowerMgmt` - Start/stop/restart VMs
   - `VM.Audit` - View VM details
   - `Pool.Audit` - View resource pools (if using)

4. Assign the role to your user:
   - Go to **Permissions** → **Users**
   - Select your user
   - Add the role to the user

## Step 3: Configure in C-Net Dashboard

1. **Log in to C-Net Dashboard**
   - Navigate to your C-Net installation
   - Sign in with your authorized Google account

2. **Navigate to Infrastructure Configuration**
   - Go to **C-Net Dashboard** → **Infrastructure** → **Proxmox**

3. **Enter Connection Details**
   - **Proxmox Host**: Your Proxmox server hostname or IP (without `https://` or port)
     - Example: `proxmox.example.com` or `192.168.1.100`
   - **Proxmox User**: The full token format
     - Format: `user@realm!token-name`
     - Example: `root@pam!c-net-dashboard`
   - **Proxmox Token**: The secret part of the token
     - Format: `secret-uuid`
     - Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
   - **Verify SSL**: 
     - ✅ Check this if your Proxmox has a valid SSL certificate
     - ⬜ Uncheck if using self-signed certificates (common in homelabs)

4. **Test Connection**
   - Click **Save** or **Test Connection** (if available)
   - The system will verify the connection before saving

## Step 4: SSL Certificate Handling

### Self-Signed Certificates (Common in Homelabs)

If your Proxmox uses a self-signed certificate:

1. **Uncheck "Verify SSL"** in the configuration
2. The system will still use HTTPS but won't verify the certificate
3. ⚠️ **Security Note**: This is acceptable for internal homelab use, but not recommended for production

### Valid SSL Certificates

If you have a valid SSL certificate (Let's Encrypt, commercial, etc.):

1. **Check "Verify SSL"** in the configuration
2. The system will verify the certificate authenticity

## Troubleshooting

### "Connection Failed" Error

- **Check Host**: Ensure the hostname/IP is correct and reachable from your C-Net server
- **Check Port**: Proxmox API runs on port 8006 by default (handled automatically)
- **Check Firewall**: Ensure port 8006 is open between C-Net and Proxmox
- **Check Token**: Verify the token format is correct (`user@realm!token-name=secret`)

### "Unauthorized" Error

- **Check Token Permissions**: Verify the token has the required privileges
- **Check Token Expiry**: API tokens don't expire by default, but check if expiration is set
- **Check User Permissions**: Ensure the user has appropriate roles/permissions

### "Certificate Verification Failed" Error

- **Self-Signed Cert**: Uncheck "Verify SSL" in configuration
- **Certificate Issues**: Ensure the certificate is valid and not expired

### Testing Connection Manually

You can test the connection using curl:

```bash
curl -k -H "Authorization: PVEAPIToken=root@pam!c-net-dashboard=your-secret-here" \
  https://your-proxmox-host:8006/api2/json/version
```

Replace:
- `root@pam!c-net-dashboard` with your token ID
- `your-secret-here` with your token secret
- `your-proxmox-host` with your Proxmox hostname/IP

Expected response:
```json
{"data":{"version":"7.x","release":"...","repoid":"..."}}
```

## Security Best Practices

1. **Use Least Privilege**: Only grant the minimum permissions needed
2. **Token Rotation**: Regularly rotate API tokens
3. **Secure Storage**: Tokens are encrypted in the database
4. **Network Security**: Use VPN or firewall rules to restrict access
5. **Monitor Usage**: Regularly check API token usage in Proxmox logs

## API Token Format Reference

```
Full Token Format: user@realm!token-name=secret-uuid

Breakdown:
- user@realm: The Proxmox user (e.g., root@pam)
- token-name: The token ID you chose (e.g., c-net-dashboard)
- secret-uuid: The generated secret (UUID format)

Authorization Header:
Authorization: PVEAPIToken=user@realm!token-name=secret-uuid
```

## Next Steps

Once connected, you can:
- View all Proxmox nodes and their status
- Monitor VM and LXC container metrics
- Start, stop, and restart VMs/containers
- View storage pool information
- Collect metrics for dashboard visualization
