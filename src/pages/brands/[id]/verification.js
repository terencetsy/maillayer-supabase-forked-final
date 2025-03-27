import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { Shield, ArrowLeft, Check, Key, Mail, User, Info, ArrowRight, AlertCircle, CheckCircle, Loader } from 'lucide-react';

export default function BrandVerification() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Verification steps
    const [currentStep, setCurrentStep] = useState(1);
    const [isVerifying, setIsVerifying] = useState(false);

    // Step 1: AWS SES Credentials
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');
    const [step1Complete, setStep1Complete] = useState(false);

    // Step 2: Email Verification
    const [fromEmail, setFromEmail] = useState('');
    const [verificationSent, setVerificationSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [step2Complete, setStep2Complete] = useState(false);

    // Step 3: Sender Details
    const [fromName, setFromName] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [step3Complete, setStep3Complete] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id) {
            fetchBrandDetails();
        }
    }, [status, id, router]);

    useEffect(() => {
        // If brand data is loaded, pre-fill form fields and determine current step
        if (brand) {
            // Pre-fill AWS credentials
            if (brand.awsRegion) setAwsRegion(brand.awsRegion);
            if (brand.awsAccessKey) setAwsAccessKey(brand.awsAccessKey);
            if (brand.awsSecretKey) setAwsSecretKey('••••••••••••••••');

            // Pre-fill sender details
            if (brand.fromEmail) setFromEmail(brand.fromEmail);
            if (brand.fromName) setFromName(brand.fromName);
            if (brand.replyToEmail) setReplyToEmail(brand.replyToEmail);

            // Determine completion status of each step
            if (brand.awsRegion && brand.awsAccessKey) {
                setStep1Complete(true);

                if (brand.fromEmail) {
                    // Check if email is verified
                    checkEmailVerificationStatus(brand.fromEmail);

                    if (brand.status === 'active' || (brand.fromName && brand.replyToEmail)) {
                        setStep2Complete(true);

                        if (brand.fromName && brand.replyToEmail) {
                            setStep3Complete(true);
                        }
                    }
                }
            }

            // Set current step based on brand status
            if (brand.status === 'pending_setup') {
                if (!step1Complete) setCurrentStep(1);
                else if (!step2Complete) setCurrentStep(2);
                else if (!step3Complete) setCurrentStep(3);
            } else if (brand.status === 'pending_verification') {
                setCurrentStep(2); // Usually waiting for email verification
            } else if (brand.status === 'active') {
                // All steps are complete, show summary
                setStep1Complete(true);
                setStep2Complete(true);
                setStep3Complete(true);
            }
        }
    }, [brand]);

    const fetchBrandDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}?includeSecrets=true`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Brand not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch brand details');
                }
            }

            const data = await res.json();
            setBrand(data);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const checkEmailVerificationStatus = async (email) => {
        try {
            const res = await fetch(`/api/brands/${id}/verification/check-email?email=${encodeURIComponent(email)}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to check email verification status');
            }

            const data = await res.json();
            setEmailVerified(data.verified);
            if (data.verified) {
                setStep2Complete(true);
            }
        } catch (error) {
            console.error('Error checking email verification:', error);
            // We don't show this error to avoid cluttering the UI
        }
    };

    const handleSaveAwsCredentials = async (e) => {
        e.preventDefault();

        if (!awsRegion || !awsAccessKey || !awsSecretKey) {
            setError('Please fill in all AWS SES credentials fields');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            // Only send the secret key if it&apos; not masked
            const payload = {
                awsRegion,
                awsAccessKey,
                awsSecretKey: awsSecretKey === '••••••••••••••••' ? undefined : awsSecretKey,
            };

            const res = await fetch(`/api/brands/${id}/verification/aws-credentials`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save AWS credentials');
            }

            setSuccess('AWS credentials saved successfully');
            setStep1Complete(true);

            // Update local brand data
            fetchBrandDetails();

            // Move to next step after a short delay
            setTimeout(() => {
                setCurrentStep(2);
                setSuccess('');
            }, 1500);
        } catch (error) {
            console.error('Error saving AWS credentials:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyEmail = async (e) => {
        e.preventDefault();

        if (!fromEmail) {
            setError('Please enter the email address you want to use as your sender email');
            return;
        }

        // Basic email validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(fromEmail)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/brands/${id}/verification/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: fromEmail }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to initiate email verification');
            }

            setSuccess('Verification email sent. Please check your inbox and click the verification link.');
            setVerificationSent(true);

            // Update the from email in the brand
            await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fromEmail }),
                credentials: 'same-origin',
            });

            // Update local brand data
            fetchBrandDetails();
        } catch (error) {
            console.error('Error sending verification email:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCheckVerification = async () => {
        setIsVerifying(true);
        try {
            await checkEmailVerificationStatus(fromEmail);

            if (emailVerified) {
                setSuccess('Email verified successfully!');

                // Move to next step after a short delay
                setTimeout(() => {
                    setCurrentStep(3);
                    setSuccess('');
                }, 1500);
            } else {
                setError('Email not yet verified. Please check your inbox and click the verification link.');
            }
        } catch (error) {
            console.error('Error checking verification:', error);
            setError(error.message || 'Failed to check verification status');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSaveSenderDetails = async (e) => {
        e.preventDefault();

        if (!fromName || !replyToEmail) {
            setError('Please fill in all sender details fields');
            return;
        }

        // Basic email validation for reply-to
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(replyToEmail)) {
            setError('Please enter a valid reply-to email address');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fromName,
                    replyToEmail,
                    status: 'active', // Update status to active since all verification is complete
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to save sender details');
            }

            setSuccess('Sender details saved successfully! Your brand is now verified and ready to send campaigns.');
            setStep3Complete(true);

            // Update local brand data
            fetchBrandDetails();
        } catch (error) {
            console.error('Error saving sender details:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsVerifying(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="verification-step">
                        <div className="step-header">
                            <div className="step-icon">
                                <Key size={20} />
                            </div>
                            <h2>Step 1: Configure AWS SES</h2>
                        </div>

                        <div className="step-content">
                            <p className="step-description">To send emails, we need your Amazon SES (Simple Email Service) credentials. These will be used to send your campaigns through your own AWS account.</p>

                            <div className="info-box">
                                <Info size={18} />
                                <div>
                                    <p>
                                        <strong>How to get your AWS SES credentials:</strong>
                                    </p>
                                    <ol>
                                        <li>Log in to your AWS Management Console</li>
                                        <li>Navigate to IAM (Identity and Access Management)</li>
                                        <li>Create a new user with programmatic access</li>
                                        <li>Attach the "AmazonSESFullAccess" policy to this user</li>
                                        <li>Save the Access Key ID and Secret Access Key provided</li>
                                    </ol>
                                    <p>
                                        <a
                                            href="https://docs.aws.amazon.com/ses/latest/dg/setting-up.html"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Learn more in the AWS documentation
                                        </a>
                                    </p>
                                </div>
                            </div>

                            <form
                                onSubmit={handleSaveAwsCredentials}
                                className="verification-form"
                            >
                                <div className="form-group">
                                    <label htmlFor="awsRegion">AWS Region</label>
                                    <select
                                        id="awsRegion"
                                        value={awsRegion}
                                        onChange={(e) => setAwsRegion(e.target.value)}
                                        disabled={isVerifying}
                                    >
                                        <option value="">Select a region</option>
                                        <option value="us-east-1">US East (N. Virginia)</option>
                                        <option value="us-east-2">US East (Ohio)</option>
                                        <option value="us-west-1">US West (N. California)</option>
                                        <option value="us-west-2">US West (Oregon)</option>
                                        <option value="ca-central-1">Canada (Central)</option>
                                        <option value="eu-west-1">EU (Ireland)</option>
                                        <option value="eu-central-1">EU (Frankfurt)</option>
                                        <option value="eu-west-2">EU (London)</option>
                                        <option value="eu-west-3">EU (Paris)</option>
                                        <option value="eu-north-1">EU (Stockholm)</option>
                                        <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                        <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
                                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                        <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                                        <option value="sa-east-1">South America (São Paulo)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="awsAccessKey">AWS Access Key ID</label>
                                    <input
                                        type="text"
                                        id="awsAccessKey"
                                        value={awsAccessKey}
                                        onChange={(e) => setAwsAccessKey(e.target.value)}
                                        placeholder="AKIAIOSFODNN7EXAMPLE"
                                        disabled={isVerifying}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="awsSecretKey">AWS Secret Access Key</label>
                                    <input
                                        type="password"
                                        id="awsSecretKey"
                                        value={awsSecretKey}
                                        onChange={(e) => setAwsSecretKey(e.target.value)}
                                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                        disabled={isVerifying}
                                    />
                                    <p className="hint-text">Your secret key will be encrypted and stored securely.</p>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={isVerifying}
                                    >
                                        {isVerifying ? (
                                            <>
                                                <Loader
                                                    size={16}
                                                    className="spinner"
                                                />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                Save & Continue
                                                <ArrowRight size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="verification-step">
                        <div className="step-header">
                            <div className="step-icon">
                                <Mail size={20} />
                            </div>
                            <h2>Step 2: Verify Sender Email</h2>
                        </div>

                        <div className="step-content">
                            <p className="step-description">To comply with email sending best practices, you need to verify the email address you'll use as your sender email. Amazon SES will send a verification link to this address.</p>

                            <form
                                onSubmit={handleVerifyEmail}
                                className="verification-form"
                            >
                                <div className="form-group">
                                    <label htmlFor="fromEmail">Sender Email Address</label>
                                    <input
                                        type="email"
                                        id="fromEmail"
                                        value={fromEmail}
                                        onChange={(e) => setFromEmail(e.target.value)}
                                        placeholder="no-reply@yourdomain.com"
                                        disabled={isVerifying || emailVerified}
                                    />
                                    <p className="hint-text">This is the email address that will appear in the "From" field of your campaigns.</p>
                                </div>

                                <div className="form-actions">
                                    {!emailVerified ? (
                                        <>
                                            <button
                                                type="submit"
                                                className="btn-primary"
                                                disabled={isVerifying || verificationSent}
                                            >
                                                {isVerifying ? (
                                                    <>
                                                        <Loader
                                                            size={16}
                                                            className="spinner"
                                                        />
                                                        Sending...
                                                    </>
                                                ) : verificationSent ? (
                                                    <>
                                                        <Mail size={16} />
                                                        Verification Email Sent
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mail size={16} />
                                                        Send Verification Email
                                                    </>
                                                )}
                                            </button>

                                            {verificationSent && (
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={handleCheckVerification}
                                                    disabled={isVerifying}
                                                >
                                                    {isVerifying ? (
                                                        <>
                                                            <Loader
                                                                size={16}
                                                                className="spinner"
                                                            />
                                                            Checking...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Check size={16} />
                                                            Check Verification Status
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="verification-success">
                                                <CheckCircle size={18} />
                                                <span>Email verified successfully!</span>
                                            </div>

                                            <button
                                                type="button"
                                                className="btn-primary"
                                                onClick={() => setCurrentStep(3)}
                                            >
                                                Continue to Next Step
                                                <ArrowRight size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </form>

                            <div className="info-box">
                                <Info size={18} />
                                <div>
                                    <p>
                                        <strong>Important notes about email verification:</strong>
                                    </p>
                                    <ul>
                                        <li>You must click the verification link in the email within 24 hours</li>
                                        <li>Check your spam folder if you don't see the verification email</li>
                                        <li>In production, you should use an email address from your own domain</li>
                                        <li>If using a domain email, you may need to configure DKIM/SPF records</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="verification-step">
                        <div className="step-header">
                            <div className="step-icon">
                                <User size={20} />
                            </div>
                            <h2>Step 3: Configure Sender Details</h2>
                        </div>

                        <div className="step-content">
                            <p className="step-description">Configure how your recipients will see your emails. These details will be displayed in their inbox and will help them recognize your messages.</p>

                            <form
                                onSubmit={handleSaveSenderDetails}
                                className="verification-form"
                            >
                                <div className="form-group">
                                    <label htmlFor="fromName">Sender Name</label>
                                    <input
                                        type="text"
                                        id="fromName"
                                        value={fromName}
                                        onChange={(e) => setFromName(e.target.value)}
                                        placeholder="Company Name or Your Name"
                                        disabled={isVerifying}
                                    />
                                    <p className="hint-text">This name will appear as the sender name in recipients' inboxes.</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="replyToEmail">Reply-To Email Address</label>
                                    <input
                                        type="email"
                                        id="replyToEmail"
                                        value={replyToEmail}
                                        onChange={(e) => setReplyToEmail(e.target.value)}
                                        placeholder="support@yourdomain.com"
                                        disabled={isVerifying}
                                    />
                                    <p className="hint-text">If recipients reply to your campaigns, their emails will go to this address.</p>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={isVerifying}
                                    >
                                        {isVerifying ? (
                                            <>
                                                <Loader
                                                    size={16}
                                                    className="spinner"
                                                />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={16} />
                                                Complete Verification
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    const renderStepIndicator = () => {
        return (
            <div className="steps-indicator">
                <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${step1Complete ? 'completed' : ''}`}>
                    <div className="step-number">{step1Complete ? <Check size={16} /> : '1'}</div>
                    <div className="step-label">AWS SES Setup</div>
                </div>

                <div className="step-connector"></div>

                <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${step2Complete ? 'completed' : ''}`}>
                    <div className="step-number">{step2Complete ? <Check size={16} /> : '2'}</div>
                    <div className="step-label">Verify Email</div>
                </div>

                <div className="step-connector"></div>

                <div className={`step-item ${currentStep >= 3 ? 'active' : ''} ${step3Complete ? 'completed' : ''}`}>
                    <div className="step-number">{step3Complete ? <Check size={16} /> : '3'}</div>
                    <div className="step-label">Sender Details</div>
                </div>
            </div>
        );
    };

    if (isLoading || !brand) {
        return (
            <BrandLayout brand={null}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading verification settings...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="verification-container">
                <div className="verification-header">
                    <Link
                        href={`/brands/${id}`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to brand</span>
                    </Link>

                    <h1>
                        <Shield size={20} />
                        <span>Brand Verification</span>
                    </h1>

                    <div className="verification-status">
                        <div className={`status-badge ${brand.status === 'active' ? 'verified' : 'pending'}`}>
                            {brand.status === 'active' ? (
                                <>
                                    <Check size={14} />
                                    <span>Verified</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={14} />
                                    <span>{brand.status === 'pending_setup' ? 'Setup Needed' : 'Verification Pending'}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="alert success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                {renderStepIndicator()}

                <div className="verification-content">{renderStep()}</div>
            </div>
        </BrandLayout>
    );
}
