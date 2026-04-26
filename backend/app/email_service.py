import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = settings.EMAIL_HOST
        self.smtp_port = settings.EMAIL_PORT
        self.username = settings.EMAIL_USERNAME
        self.password = settings.EMAIL_PASSWORD

    async def send_verification_email(self, email: str, verification_code: str):
        """Send email verification code"""
        if not self.username or not self.password:
            logger.warning("Email credentials not configured. Skipping email send.")
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = self.username
            msg['To'] = email
            msg['Subject'] = "PeerLearn - Email Verification"

            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 PeerLearn</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Study Companion</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
                    <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Welcome to PeerLearn! To complete your registration, please use the verification code below:
                    </p>
                    
                    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h1 style="color: #667eea; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                            {verification_code}
                        </h1>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 20px;">
                        This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                    <p>© 2024 PeerLearn. All rights reserved.</p>
                </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(body, 'html'))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)

            logger.info(f"Verification email sent to {email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send verification email to {email}: {e}")
            return False

    async def send_welcome_email(self, email: str, name: str):
        """Send welcome email after successful registration"""
        if not self.username or not self.password:
            logger.warning("Email credentials not configured. Skipping email send.")
            return False

        try:
            msg = MIMEMultipart()
            msg['From'] = self.username
            msg['To'] = email
            msg['Subject'] = "Welcome to PeerLearn! 🎓"

            body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 PeerLearn</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your Study Companion</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Welcome, {name}! 🎉</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Your account has been successfully created and verified. You're now ready to start your learning journey with PeerLearn!
                    </p>
                    
                    <div style="background: white; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                        <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
                        <ul style="color: #666; line-height: 1.8;">
                            <li>Create or join study classrooms</li>
                            <li>Connect with classmates and friends</li>
                            <li>Collaborate in real-time chat rooms</li>
                            <li>Track your learning streaks</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                            Start Learning Now
                        </a>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
                    <p>© 2024 PeerLearn. All rights reserved.</p>
                </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(body, 'html'))

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)

            logger.info(f"Welcome email sent to {email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send welcome email to {email}: {e}")
            return False

    async def send_teacher_approval_email(self, email: str, name: str):
        """Notify a teacher their application has been approved."""
        if not self.username or not self.password:
            logger.warning("Email credentials not configured. Skipping approval email.")
            return False
        try:
            msg = MIMEMultipart()
            msg['From'] = self.username
            msg['To'] = email
            msg['Subject'] = "Your teacher application has been approved! 🎉"
            body = f"""
            <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 PeerLearn</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Teacher Approval</p>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #333;">Congratulations, {name}! 🎉</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        We're thrilled to let you know that your teacher application on PeerLearn has been
                        <strong style="color: #10b981;">approved</strong>!
                    </p>
                    <div style="background: white; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                        <h3 style="color: #333; margin-top: 0;">You can now:</h3>
                        <ul style="color: #666; line-height: 1.8;">
                            <li>Access your full teacher dashboard</li>
                            <li>List your sessions and set your availability</li>
                            <li>Accept hire requests from students</li>
                            <li>Build your reputation through student reviews</li>
                        </ul>
                    </div>
                    <p style="color: #666;">Log in to PeerLearn now and start teaching!</p>
                </div>
                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                    <p>© 2024 PeerLearn Team. All rights reserved.</p>
                </div>
            </body></html>
            """
            msg.attach(MIMEText(body, 'html'))
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            logger.info(f"Approval email sent to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send approval email to {email}: {e}")
            return False

    async def send_teacher_rejection_email(self, email: str, name: str, reason: str):
        """Notify a teacher their application was not approved, with the reason."""
        if not self.username or not self.password:
            logger.warning("Email credentials not configured. Skipping rejection email.")
            return False
        try:
            msg = MIMEMultipart()
            msg['From'] = self.username
            msg['To'] = email
            msg['Subject'] = "Update on your PeerLearn teacher application"
            body = f"""
            <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🎓 PeerLearn</h1>
                    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Application Update</p>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                    <h2 style="color: #333;">Hi {name},</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        Thank you for applying to become a teacher on PeerLearn. After careful review,
                        we're unable to approve your application at this time.
                    </p>
                    <div style="background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                        <h3 style="color: #333; margin-top: 0;">Feedback from our team:</h3>
                        <p style="color: #555; line-height: 1.6;">{reason}</p>
                    </div>
                    <p style="color: #666; line-height: 1.6;">
                        We encourage you to address this feedback and reapply — many of our best teachers
                        were approved on their second application. We genuinely look forward to hearing from you again.
                    </p>
                    <p style="color: #666;">The PeerLearn Team</p>
                </div>
                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                    <p>© 2024 PeerLearn Team. All rights reserved.</p>
                </div>
            </body></html>
            """
            msg.attach(MIMEText(body, 'html'))
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            logger.info(f"Rejection email sent to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send rejection email to {email}: {e}")
            return False

email_service = EmailService()

