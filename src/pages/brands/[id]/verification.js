import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Check, AlertCircle, CheckCircle, Loader, Copy, RefreshCw } from 'lucide-react';
import { AWS_SES_REGIONS } from '@/constants/awsRegions';

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

    // Step 1: Provider Selection
    const [emailProvider, setEmailProvider] = useState('ses');
    const [step1Complete, setStep1Complete] = useState(false);

    // Step 2: Provider Credentials
    // AWS SES
    const [awsRegion, setAwsRegion] = useState('');
    const [awsAccessKey, setAwsAccessKey] = useState('');
    const [awsSecretKey, setAwsSecretKey] = useState('');
    // SendGrid
    const [sendgridApiKey, setSendgridApiKey] = useState('');
    // Mailgun
    const [mailgunApiKey, setMailgunApiKey] = useState('');
    const [mailgunDomain, setMailgunDomain] = useState('');
    const [mailgunRegion, setMailgunRegion] = useState('us');
    const [step2Complete, setStep2Complete] = useState(false);

    // Step 3: Domain
    const [domain, setDomain] = useState('');
    const [verificationSent, setVerificationSent] = useState(false);
    const [domainVerified, setDomainVerified] = useState(false);
    const [dkimVerified, setDkimVerified] = useState(false);
    const [verificationToken, setVerificationToken] = useState('');
    const [dkimTokens, setDkimTokens] = useState([]);
    const [step3Complete, setStep3Complete] = useState(false);

    // Step 4: Sender
    const [fromName, setFromName] = useState('');
    const [fromEmail, setFromEmail] = useState('');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [step4Complete, setStep4Complete] = useState(false);

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
            // Set provider - only update from brand if it's explicitly set in the database
            // This prevents overwriting user's selection with default 'ses'
            const provider = brand.emailProvider || 'ses';
            if (brand.emailProvider) {
                setEmailProvider(brand.emailProvider);
            }

            // AWS SES credentials
            if (brand.awsRegion) setAwsRegion(brand.awsRegion);
            if (brand.awsAccessKey) setAwsAccessKey(brand.awsAccessKey);
            if (brand.awsSecretKey) setAwsSecretKey('••••••••••••••••');

            // SendGrid credentials
            if (brand.sendgridApiKey) setSendgridApiKey('••••••••••••••••');

            // Mailgun credentials
            if (brand.mailgunApiKey) setMailgunApiKey('••••••••••••••••');
            if (brand.mailgunDomain) setMailgunDomain(brand.mailgunDomain);
            if (brand.mailgunRegion) setMailgunRegion(brand.mailgunRegion);

            // Domain
            if (brand.sendingDomain) {
                setDomain(brand.sendingDomain);
                if (provider === 'ses') {
                    checkDomainVerificationStatus(brand.sendingDomain);
                } else {
                    // For SendGrid/Mailgun, domain verification is handled differently
                    setDomainVerified(true);
                    setDkimVerified(true);
                }
            }

            // Sender details
            if (brand.fromName) setFromName(brand.fromName);
            if (brand.fromEmail) setFromEmail(brand.fromEmail);
            if (brand.replyToEmail) setReplyToEmail(brand.replyToEmail);

            // Determine step completion based on provider
            let isStep1Complete = !!brand.emailProvider;
            let isStep2Complete = false;
            let isStep3Complete = false;
            let isStep4Complete = false;

            if (provider === 'ses') {
                isStep2Complete = !!(brand.awsRegion && brand.awsAccessKey && brand.awsSecretKey);
                if (isStep2Complete && brand.sendingDomain) {
                    setVerificationSent(true);
                    if (brand.status === 'active' || (brand.fromName && brand.replyToEmail)) {
                        isStep3Complete = true;
                    }
                }
            } else if (provider === 'sendgrid') {
                isStep2Complete = !!brand.sendgridApiKey;
                if (isStep2Complete && brand.sendingDomain) {
                    isStep3Complete = true;
                }
            } else if (provider === 'mailgun') {
                isStep2Complete = !!(brand.mailgunApiKey && brand.mailgunDomain);
                if (isStep2Complete && brand.sendingDomain) {
                    isStep3Complete = true;
                }
            }

            if (isStep3Complete && brand.fromName && brand.fromEmail && brand.replyToEmail) {
                isStep4Complete = true;
            }

            // Set step completion states
            setStep1Complete(isStep1Complete);
            setStep2Complete(isStep2Complete);
            setStep3Complete(isStep3Complete);
            setStep4Complete(isStep4Complete);

            // Determine current step
            if (brand.status === 'active') {
                setStep1Complete(true);
                setStep2Complete(true);
                setStep3Complete(true);
                setStep4Complete(true);
            } else if (brand.status === 'pending_verification') {
                setCurrentStep(3);
            } else {
                // pending_setup or other
                if (!isStep1Complete) setCurrentStep(1);
                else if (!isStep2Complete) setCurrentStep(2);
                else if (!isStep3Complete) setCurrentStep(3);
                else if (!isStep4Complete) setCurrentStep(4);
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
                setStep3Complete(true);
            }
            return data;
        } catch (error) {
            return null;
        }
    };

    const handleSelectProvider = async (e) => {
        e.preventDefault();
        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailProvider }),
                credentials: 'same-origin',
            });

            if (!res.ok) throw new Error('Failed to save provider');

            setSuccess('Provider selected');
            setStep1Complete(true);
            // Don't call fetchBrandDetails here - it would reset the emailProvider state
            // Just move to step 2 directly since we already have the correct provider in state

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
            setStep2Complete(true);
            fetchBrandDetails();

            setTimeout(() => {
                setCurrentStep(3);
                setSuccess('');
            }, 1000);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSaveSendgridCredentials = async (e) => {
        e.preventDefault();
        if (!sendgridApiKey) {
            setError('API key is required');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                sendgridApiKey: sendgridApiKey === '••••••••••••••••' ? undefined : sendgridApiKey,
            };

            const res = await fetch(`/api/brands/${id}/verification/sendgrid-credentials`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'same-origin',
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save credentials');

            setSuccess('SendGrid credentials verified');
            setStep2Complete(true);
            fetchBrandDetails();

            setTimeout(() => {
                setCurrentStep(3);
                setSuccess('');
            }, 1000);
        } catch (error) {
            setError(error.message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSaveMailgunCredentials = async (e) => {
        e.preventDefault();
        if (!mailgunApiKey || !mailgunDomain) {
            setError('API key and domain are required');
            return;
        }

        setIsVerifying(true);
        setError('');
        setSuccess('');

        try {
            const payload = {
                mailgunApiKey: mailgunApiKey === '••••••••••••••••' ? undefined : mailgunApiKey,
                mailgunDomain,
                mailgunRegion,
            };

            const res = await fetch(`/api/brands/${id}/verification/mailgun-credentials`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'same-origin',
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to save credentials');

            setSuccess('Mailgun credentials verified');
            setStep2Complete(true);
            // Also set the sending domain from mailgun domain
            setDomain(mailgunDomain);
            fetchBrandDetails();

            setTimeout(() => {
                setCurrentStep(3);
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
            if (emailProvider === 'ses') {
                // AWS SES domain verification
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
            } else {
                // For SendGrid/Mailgun, we just save the domain
                // Domain verification is done through their respective dashboards
                setSuccess('Domain saved');
                setDomainVerified(true);
                setDkimVerified(true);
                setStep3Complete(true);
            }

            await fetch(`/api/brands/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sendingDomain: domain }),
                credentials: 'same-origin',
            });

            fetchBrandDetails();

            if (emailProvider !== 'ses') {
                setTimeout(() => {
                    setCurrentStep(4);
                    setSuccess('');
                }, 1000);
            }
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
                    setCurrentStep(4);
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
            setStep4Complete(true);
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

    const getProviderLabel = (provider) => {
        switch (provider) {
            case 'ses':
                return 'Amazon SES';
            case 'sendgrid':
                return 'SendGrid';
            case 'mailgun':
                return 'Mailgun';
            default:
                return provider;
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <form
                        onSubmit={handleSelectProvider}
                        className="verify-form"
                    >
                        <div className="form-group">
                            <label>Email Provider</label>
                            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>Select the email service provider you want to use for sending emails.</p>
                            <div className="provider-options">
                                <label className={`provider-option ${emailProvider === 'ses' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="emailProvider"
                                        value="ses"
                                        checked={emailProvider === 'ses'}
                                        onChange={(e) => setEmailProvider(e.target.value)}
                                        disabled={isVerifying}
                                    />
                                    <div className="provider-info">
                                        <strong>Amazon SES</strong>
                                        <span>Best for high volume, cost-effective sending</span>
                                    </div>
                                </label>
                                <label className={`provider-option ${emailProvider === 'sendgrid' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="emailProvider"
                                        value="sendgrid"
                                        checked={emailProvider === 'sendgrid'}
                                        onChange={(e) => setEmailProvider(e.target.value)}
                                        disabled={isVerifying}
                                    />
                                    <div className="provider-info">
                                        <strong>SendGrid</strong>
                                        <span>Popular choice with great deliverability</span>
                                    </div>
                                </label>
                                <label className={`provider-option ${emailProvider === 'mailgun' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="emailProvider"
                                        value="mailgun"
                                        checked={emailProvider === 'mailgun'}
                                        onChange={(e) => setEmailProvider(e.target.value)}
                                        disabled={isVerifying}
                                    />
                                    <div className="provider-info">
                                        <strong>Mailgun</strong>
                                        <span>Developer-friendly with powerful APIs</span>
                                    </div>
                                </label>
                            </div>
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
                // Render provider-specific credential forms
                if (emailProvider === 'ses') {
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
                                    {AWS_SES_REGIONS.map((region) => (
                                        <option
                                            key={region.value}
                                            value={region.value}
                                        >
                                            {region.label} ({region.value})
                                        </option>
                                    ))}
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

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="button button--secondary"
                                    onClick={() => setCurrentStep(1)}
                                    disabled={isVerifying}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
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
                            </div>
                        </form>
                    );
                } else if (emailProvider === 'sendgrid') {
                    return (
                        <form
                            onSubmit={handleSaveSendgridCredentials}
                            className="verify-form"
                        >
                            <div className="form-group">
                                <label>SendGrid API Key</label>
                                <input
                                    type="password"
                                    value={sendgridApiKey}
                                    onChange={(e) => setSendgridApiKey(e.target.value)}
                                    placeholder="SG.xxxxx..."
                                    disabled={isVerifying}
                                />
                                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                                    Get your API key from{' '}
                                    <a
                                        href="https://app.sendgrid.com/settings/api_keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        SendGrid Dashboard
                                    </a>
                                </small>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="button button--secondary"
                                    onClick={() => setCurrentStep(1)}
                                    disabled={isVerifying}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
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
                                        <span>Verify & Continue</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    );
                } else if (emailProvider === 'mailgun') {
                    return (
                        <form
                            onSubmit={handleSaveMailgunCredentials}
                            className="verify-form"
                        >
                            <div className="form-group">
                                <label>Mailgun API Key</label>
                                <input
                                    type="password"
                                    value={mailgunApiKey}
                                    onChange={(e) => setMailgunApiKey(e.target.value)}
                                    placeholder="key-xxxxx..."
                                    disabled={isVerifying}
                                />
                                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                                    Get your API key from{' '}
                                    <a
                                        href="https://app.mailgun.com/settings/api_security"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Mailgun Dashboard
                                    </a>
                                </small>
                            </div>

                            <div className="form-group">
                                <label>Mailgun Domain</label>
                                <input
                                    type="text"
                                    value={mailgunDomain}
                                    onChange={(e) => setMailgunDomain(e.target.value)}
                                    placeholder="mg.yourdomain.com"
                                    disabled={isVerifying}
                                />
                                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>The domain you verified in Mailgun (usually mg.yourdomain.com)</small>
                            </div>

                            <div className="form-group">
                                <label>Mailgun Region</label>
                                <select
                                    value={mailgunRegion}
                                    onChange={(e) => setMailgunRegion(e.target.value)}
                                    disabled={isVerifying}
                                >
                                    <option value="us">US</option>
                                    <option value="eu">EU</option>
                                </select>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="button button--secondary"
                                    onClick={() => setCurrentStep(1)}
                                    disabled={isVerifying}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
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
                                        <span>Verify & Continue</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    );
                }
                return null;

            case 3:
                // Domain verification step
                if (emailProvider === 'ses') {
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

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="button button--secondary"
                                            onClick={() => setCurrentStep(2)}
                                            disabled={isVerifying}
                                        >
                                            <ArrowLeft size={16} />
                                            <span>Back</span>
                                        </button>
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
                                    </div>
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

                                    <div className="form-actions">
                                        <button
                                            type="button"
                                            className="button button--secondary"
                                            onClick={() => setCurrentStep(2)}
                                            disabled={isVerifying}
                                        >
                                            <ArrowLeft size={16} />
                                            <span>Back</span>
                                        </button>
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
                                </div>
                            )}
                        </>
                    );
                } else {
                    // SendGrid/Mailgun - simplified domain step
                    return (
                        <form
                            onSubmit={handleVerifyDomain}
                            className="verify-form"
                        >
                            <div className="form-group">
                                <label>Sending Domain</label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="example.com"
                                    disabled={isVerifying}
                                />
                                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                                    {emailProvider === 'sendgrid' ? (
                                        <>
                                            Make sure this domain is verified in your{' '}
                                            <a
                                                href="https://app.sendgrid.com/settings/sender_auth"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                SendGrid Sender Authentication
                                            </a>
                                        </>
                                    ) : (
                                        <>
                                            This should match the domain you verified in{' '}
                                            <a
                                                href="https://app.mailgun.com/mg/sending/domains"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Mailgun Domains
                                            </a>
                                        </>
                                    )}
                                </small>
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="button button--secondary"
                                    onClick={() => setCurrentStep(2)}
                                    disabled={isVerifying}
                                >
                                    <ArrowLeft size={16} />
                                    <span>Back</span>
                                </button>
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
                            </div>
                        </form>
                    );
                }

            case 4:
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

                        <div className="form-actions">
                            <button
                                type="button"
                                className="button button--secondary"
                                onClick={() => setCurrentStep(3)}
                                disabled={isVerifying}
                            >
                                <ArrowLeft size={16} />
                                <span>Back</span>
                            </button>
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
                        </div>
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
                        <span>Provider</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${currentStep >= 2 ? 'active' : ''} ${step2Complete ? 'done' : ''}`}>
                        <div className="step-num">{step2Complete ? <Check size={14} /> : '2'}</div>
                        <span>{step1Complete ? getProviderLabel(emailProvider).split(' ')[0] : 'Credentials'}</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${currentStep >= 3 ? 'active' : ''} ${step3Complete ? 'done' : ''}`}>
                        <div className="step-num">{step3Complete ? <Check size={14} /> : '3'}</div>
                        <span>Domain</span>
                    </div>
                    <div className="step-line"></div>
                    <div className={`step ${currentStep >= 4 ? 'active' : ''} ${step4Complete ? 'done' : ''}`}>
                        <div className="step-num">{step4Complete ? <Check size={14} /> : '4'}</div>
                        <span>Sender</span>
                    </div>
                </div>

                <div className="verify-card">{renderStep()}</div>
            </div>
        </BrandLayout>
    );
}
