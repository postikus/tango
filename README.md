# Tango Clone

A simple analog of Tango.com built with Golang, React, and WebSockets for AWS deployment.

## Features

- Real-time screen sharing via WebSockets
- Session management
- Activity logging
- Modern UI with Tailwind CSS

## Project Structure

```
tango-clone/
├── backend/           # Golang backend
│   ├── main.go        # Main application code
│   ├── utils.go       # Utility functions
│   └── Dockerfile     # Docker configuration for backend
├── frontend/          # React frontend
│   └── frontend/      # React application
├── terraform/         # AWS deployment configuration
│   └── main.tf        # Terraform configuration
└── deployment/        # Deployment scripts and configurations
    └── deploy.sh      # Automated deployment script
```

## Local Development

### Backend

1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Run the backend server:
   ```
   go run *.go
   ```

3. The server will start on http://localhost:8080

### Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. The frontend will be available at http://localhost:5173

## AWS Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform installed
- Docker installed

### Automated Deployment

1. Configure AWS CLI with your credentials:
   ```
   aws configure
   ```
   
   Enter your AWS Access Key ID, Secret Access Key, and preferred region.

2. Run the deployment script:
   ```
   cd deployment
   ./deploy.sh
   ```

   This script will:
   - Build the backend Docker image
   - Create an ECR repository if it doesn't exist
   - Push the Docker image to ECR
   - Deploy the infrastructure using Terraform
   - Update the frontend environment with the deployed backend URL
   - Build and deploy the frontend to S3
   - Output the URLs for both backend and frontend

### Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

1. Build and push the Docker image:
   ```
   cd backend
   docker build -t tango-clone .
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.<your-region>.amazonaws.com
   docker tag tango-clone:latest <your-aws-account-id>.dkr.ecr.<your-region>.amazonaws.com/tango-clone-repo:latest
   docker push <your-aws-account-id>.dkr.ecr.<your-region>.amazonaws.com/tango-clone-repo:latest
   ```

2. Deploy using Terraform:
   ```
   cd ../terraform
   terraform init
   terraform apply
   ```

3. Update the frontend environment variables with the deployed backend URL:
   ```
   cd ../frontend/frontend
   ```
   
   Edit the `.env` file to update the `VITE_API_URL` with your ECS service URL.

4. Build and deploy the frontend:
   ```
   npm run build
   ```
   
   Deploy the `dist` directory to an S3 bucket configured for static website hosting:
   ```
   aws s3 mb s3://tango-clone-frontend
   aws s3 website s3://tango-clone-frontend --index-document index.html --error-document index.html
   aws s3 sync dist s3://tango-clone-frontend
   ```

## Notes

- This is a simplified version of Tango.com for demonstration purposes
- The application uses an in-memory database, so data will be lost when the server restarts
- For production use, consider adding authentication, persistent storage, and HTTPS
- The Terraform configuration may need adjustments based on your AWS account setup, particularly subnet IDs
