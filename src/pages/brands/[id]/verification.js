import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Check, AlertCircle, CheckCircle, Loader, Copy, RefreshCw } from 'lucide-react';

function CopyField({ value, label, isCode }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipText, setTooltipText] = useState('Click to copy');

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setTooltipText('Copied!');
            setTimeout(() => {
                setTooltipText('Click to copy');
            }, 2000);
        } catch (err) {
            setTooltipText('Failed to copy');
            setTimeout(() => {
                setTooltipText('Click to copy');
            }, 2000);
        }
    };

    return (
        <div
            className="copy-field"
            onClick={handleCopy}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {isCode ? <code className="copyable">{value}</code> : <span className="copyable">{value}</span>}
            {showTooltip && <div className="tooltip">{tooltipText}</div>}
        </div>
    );
}

export default function BrandVerification() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id } = router.query;

    const [brand, setBrand] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [currentStep, setCurrentStep] = useState(1);
    const [isVerifying, setIsVerifying] = useState(false);

    // Step 1: AWS SES
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');
    const [step1Complete, setStep1Complete] = useState(false);

    // Step 2: Domain
    const [domain, setDomain] = useState('');
    const [verificationSent, setVerificationSent] = useState(false);
    const [domainVerified, setDomainVerified] = useState(false);
    const [dkimVerified, setDkimVerified] = useState(false);
    const [verificationToken, setVerificationToken] = useState('');
    const [dkimTokens, setDkimTokens] = useState([]);
    const [step2Complete, setStep2Complete] = useState(false);

    // Step 3: Sender
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
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
        if (brand) {
            if (brand.awsRegion) setAwsRegion(brand.awsRegion);
            if (brand.awsAccessKey) setAwsAccessKey(brand.awsAccessKey);
            if (brand.awsSecretKey) setAwsSecretKey('••••••••••••••••');

            if (brand.sendingDomain) {
                setDomain(brand.sendingDomain);
                checkDomainVerificationStatus(brand.sendingDomain);
            }

            if (brand.fromName) setFromName(brand.fromName);
            if (brand.fromEmail) setFromEmail(brand.fromEmail);
            if (brand.replyToEmail) setReplyToEmail(brand.replyToEmail);

            if (brand.awsRegion && brand.awsAccessKey) {
                setStep1Complete(true);
                if (brand.sendingDomain) {
                    setVerificationSent(true);
                    if (brand.status === 'active' || (brand.fromName && brand.replyToEmail)) {
                        setStep2Complete(true);
                        if (brand.fromName && brand.fromEmail && brand.replyToEmail) {
                            setStep3Complete(true);
                        }
                    }
                }
            }

            if (brand.status === 'pending_setup') {
                if (!step1Complete) setCurrentStep(1);
                else if (!step2Complete) setCurrentStep(2);
                else if (!step3Complete) setCurrentStep(3);
            } else if (brand.status === 'pending_verification') {
                setCurrentStep(2);
            } else if (brand.status === 'active') {
                setStep1Complete(true);
                setStep2Complete(true);
                setStep3Complete(true);
            }
        }
    }, [brand]);

    const fetchBrandDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}?includeSecrets=true`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to fetch brand details');
            const data = await res.json();
            setBrand(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const checkDomainVerificationStatus = async (domainToCheck) => {
        try {
            const res = await fetch(`/api/brands/${id}/verification/check-domain?domain=${encodeURIComponent(domainToCheck)}`, { credentials: 'same-origin' });
            if (!res.ok) throw new Error('Failed to check domain');
            const data = await res.json();
            setDomainVerified(data.domainVerified);
            setDkimVerified(data.dkimVerified);
            setVerificationToken(data.verificationToken);
            setDkimTokens(data.dkimTokens || []);
            if (data.domainVerified && data.dkimVerified) {
                setStep2Complete(true);
            }
            return data;
        } catch (error) {
            return null;
        }
    };

    const handleSaveAwsCredentials = async (e) => {
        e.preventDefault();
        if (!awsRegion || !awsAccessKey || !awsSecretKey) {
            setError('All fields required');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                awsRegion,
                awsAccessKey,
                awsSecretKey: awsSecretKey === '••••••••••••••••' ? undefined : awsSecretKey,
            };

            const res = await fetch(`/api/brands/${id}/verification/aws-credentials`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to save credentials');

            setSuccess('Credentials saved');
            setStep1Complete(true);
            fetchBrandDetails();

            setTimeout(() => {
                setCurrentStep(2);
                setSuccess('');
            }, 1000);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleVerifyDomain = async (e) => {
        e.preventDefault();
        if (!domain) {
            setError('Domain required');
            return;
        }

        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
        if (!domainRegex.test(domain)) {
            setError('Invalid domain');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/brands/${id}/verification/verify-domain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain }),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to verify domain');

            const data = await res.json();
            setVerificationToken(data.verificationToken);
            setDkimTokens(data.dkimTokens || []);
            setSuccess('Add DNS records below');
            setVerificationSent(true);

            await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sendingDomain: domain }),
                credentials: 'same-origin',
            });

            fetchBrandDetails();
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleCheckVerification = async () => {
        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const data = await checkDomainVerificationStatus(domain);
            if (!data) throw new Error('Failed to check status');

            if (data.domainVerified && data.dkimVerified) {
                setSuccess('Domain verified!');

                await fetch(`/api/brands/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'active' }),
                    credentials: 'same-origin',
                });

                setTimeout(() => {
                    setCurrentStep(3);
                    setSuccess('');
                }, 1000);
            } else {
                setError('DNS records not found. Wait a few minutes and try again.');
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSaveSenderDetails = async (e) => {
        e.preventDefault();
        if (!fromName || !fromEmail || !replyToEmail) {
            setError('All fields required');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(fromEmail) || !emailPattern.test(replyToEmail)) {
            setError('Invalid email');
            return;
        }

        const fromEmailDomain = fromEmail.split('@')[1];
        if (fromEmailDomain !== domain) {
            setError(`Use ${domain} domain`);
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromName,
                    fromEmail,
                    replyToEmail,
                    status: 'active',
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to save');

            setSuccess('Verification complete!');
            setStep3Complete(true);
            fetchBrandDetails();

            setTimeout(() => {
                router.push(`/brands/${id}`);
            }, 1500);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied!');
        setTimeout(() => setSuccess(''), 1500);
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <form
                        onSubmit={handleSaveAwsCredentials}
                        className="verify-form"
                    >
                        <div className="form-group">
                            <label>AWS Region</label>
                            <select
                                value={awsRegion}
                                onChange={(e) => setAwsRegion(e.target.value)}
                                disabled={isVerifying}
                            >
                                <option value="">Select region</option>

                                {/* North America */}
                                <option value="us-east-1">US East (N. Virginia)</option>
                                <option value="us-east-2">US East (Ohio)</option>
                                <option value="us-west-1">US West (N. California)</option>
                                <option value="us-west-2">US West (Oregon)</option>
                                <option value="ca-central-1">Canada (Central)</option>
                                <option value="ca-west-1">Canada West (Calgary)</option>

                                {/* Europe */}
                                <option value="eu-west-1">Europe (Ireland)</option>
                                <option value="eu-west-2">Europe (London)</option>
                                <option value="eu-west-3">Europe (Paris)</option>
                                <option value="eu-central-1">Europe (Frankfurt)</option>
                                <option value="eu-central-2">Europe (Zurich)</option>
                                <option value="eu-south-1">Europe (Milan)</option>
                                <option value="eu-north-1">Europe (Stockholm)</option>

                                {/* Asia Pacific */}
                                <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                                <option value="ap-south-2">Asia Pacific (Hyderabad)</option>
                                <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                                <option value="ap-southeast-2">Asia Pacific (Sydney)</option>
                                <option value="ap-southeast-3">Asia Pacific (Jakarta)</option>
                                <option value="ap-southeast-5">Asia Pacific (Malaysia)</option>
                                <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                <option value="ap-northeast-2">Asia Pacific (Seoul)</option>
                                <option value="ap-northeast-3">Asia Pacific (Osaka)</option>

                                {/* Middle East & Africa */}
                                <option value="me-south-1">Middle East (Bahrain)</option>
                                <option value="me-central-1">Middle East (UAE)</option>
                                <option value="il-central-1">Israel (Tel Aviv)</option>
                                <option value="af-south-1">Africa (Cape Town)</option>

                                {/* South America */}
                                <option value="sa-east-1">South America (São Paulo)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Access Key</label>
                            <input
                                type="text"
                                value={awsAccessKey}
                                onChange={(e) => setAwsAccessKey(e.target.value)}
                                placeholder="AKIA..."
                                disabled={isVerifying}
                            />
                        </div>

                        <div className="form-group">
                            <label>Secret Key</label>
                            <input
                                type="password"
                                value={awsSecretKey}
                                onChange={(e) => setAwsSecretKey(e.target.value)}
                                placeholder="Enter secret"
                                disabled={isVerifying}
                            />
                        </div>

                        <button
                            type="submit"
                            className="button button--primary"
                            disabled={isVerifying}
                        >
                            {isVerifying ? (
                                <>
                                    <Loader
                                        size={16}
                                        className="spinner"
                                    />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>Continue</span>
                            )}
                        </button>
                    </form>
                );

            case 2:
                return (
                    <>
                        {!verificationSent ? (
                            <form
                                onSubmit={handleVerifyDomain}
                                className="verify-form"
                            >
                                <div className="form-group">
                                    <label>Domain</label>
                                    <input
                                        type="text"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value)}
                                        placeholder="example.com"
                                        disabled={isVerifying}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="button button--primary"
                                    disabled={isVerifying}
                                >
                                    {isVerifying ? (
                                        <>
                                            <Loader
                                                size={16}
                                                className="spinner"
                                            />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                        <span>Verify Domain</span>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="dns-setup">
                                <div className="status-row">
                                    <div className={`status-pill ${domainVerified ? 'verified' : 'pending'}`}>
                                        {domainVerified ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        <span>Domain {domainVerified ? 'Verified' : 'Pending'}</span>
                                    </div>
                                    <div className={`status-pill ${dkimVerified ? 'verified' : 'pending'}`}>
                                        {dkimVerified ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                        <span>DKIM {dkimVerified ? 'Verified' : 'Pending'}</span>
                                    </div>
                                </div>

                                <div className="dns-section">
                                    <h4>Add these DNS records to your domain:</h4>

                                    <div className="dns-table-container">
                                        <table className="dns-table">
                                            <thead>
                                                <tr>
                                                    <th>Type</th>
                                                    <th>Name</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td data-label="Type">
                                                        <span className="record-type">TXT</span>
                                                    </td>
                                                    <td
                                                        data-label="Name"
                                                        className="record-name"
                                                    >
                                                        <CopyField
                                                            value={`_amazonses.${domain}`}
                                                            label="name"
                                                        />
                                                    </td>
                                                    <td data-label="Value">
                                                        <CopyField
                                                            value={verificationToken}
                                                            label="value"
                                                            isCode
                                                        />
                                                    </td>
                                                </tr>

                                                {dkimTokens.map((token, index) => (
                                                    <tr key={index}>
                                                        <td data-label="Type">
                                                            <span className="record-type">CNAME</span>
                                                        </td>
                                                        <td
                                                            data-label="Name"
                                                            className="record-name"
                                                        >
                                                            <CopyField
                                                                value={`${token}._domainkey.${domain}`}
                                                                label="name"
                                                            />
                                                        </td>
                                                        <td data-label="Value">
                                                            <CopyField
                                                                value={`${token}.dkim.amazonses.com`}
                                                                label="value"
                                                                isCode
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="button button--primary"
                                    onClick={handleCheckVerification}
                                    disabled={isVerifying}
                                >
                                    {isVerifying ? (
                                        <>
                                            <Loader
                                                size={16}
                                                className="spinner"
                                            />
                                            <span>Checking...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} />
                                            <span>Check Status</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                );

            case 3:
                return (
                    <form
                        onSubmit={handleSaveSenderDetails}
                        className="verify-form"
                    >
                        <div className="form-group">
                            <label>Sender Name</label>
                            <input
                                type="text"
                                value={fromName}
                                onChange={(e) => setFromName(e.target.value)}
                                placeholder="Your Company"
                                disabled={isVerifying}
                            />
                        </div>

                        <div className="form-group">
                            <label>From Email</label>
                            <div className="email-input">
                                <input
                                    type="text"
                                    value={fromEmail.split('@')[0] || ''}
                                    onChange={(e) => setFromEmail(`${e.target.value}@${domain}`)}
                                    placeholder="noreply"
                                    disabled={isVerifying}
                                />
                                <span>@{domain}</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Reply-To Email</label>
                            <input
                                type="email"
                                value={replyToEmail}
                                onChange={(e) => setReplyToEmail(e.target.value)}
                                placeholder={`support@${domain}`}
                                disabled={isVerifying}
                            />
                        </div>

                        <button
                            type="submit"
                            className="button button--primary"
                            disabled={isVerifying}
                        >
                            {isVerifying ? (
                                <>
                                    <Loader
                                        size={16}
                                        className="spinner"
                                    />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    <span>Complete</span>
                                </>
                            )}
                        </button>
                    </form>
                );

            default:
                return null;
        }
    };

    if (isLoading || !brand) {
        return (
            <BrandLayout brand={null}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="verify-container">
                <div className="verify-header">
                    <Link
                        href={`/brands/${id}`}
                        className="back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </Link>
                    <h1>Verification</h1>
                </div>

                {error && (
                    <div className="alert alert-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="alert alert-success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                <div className="steps">
                    <div className={`step ${currentStep >= 1 ? 'active' : ''} ${step1Complete ? 'done' : ''}`}>
                        <div className="step-num">{step1Complete ? <Check size={14} /> : '1'}</div>
                        <span>AWS</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${currentStep >= 2 ? 'active' : ''} ${step2Complete ? 'done' : ''}`}>
                        <div className="step-num">{step2Complete ? <Check size={14} /> : '2'}</div>
                        <span>Domain</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${currentStep >= 3 ? 'active' : ''} ${step3Complete ? 'done' : ''}`}>
                        <div className="step-num">{step3Complete ? <Check size={14} /> : '3'}</div>
                        <span>Sender</span>
                    </div>
                </div>

                <div className="verify-card">{renderStep()}</div>
            </div>
        </BrandLayout>
    );
}
