import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Send, Calendar, Clock, CheckCircle, Users, Mail, AlertCircle, X, Info, Droplet } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'react-datepicker/dist/react-datepicker.css';

// Dynamically import DatePicker with SSR disabled
const DatePicker = dynamic(() => import('react-datepicker'), {
    ssr: false,
});

export default function SendCampaign() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { id, campaignId } = router.query;

    const [brand, setBrand] = useState(null);
    const [campaign, setCampaign] = useState(null);
    const [contactLists, setContactLists] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingLists, setIsLoadingLists] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Send parameters
    const [selectedLists, setSelectedLists] = useState([]);
    const [scheduleType, setScheduleType] = useState('send_now');
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [scheduledTime, setScheduledTime] = useState(new Date());
    const [totalContacts, setTotalContacts] = useState(0);
    const [activeContactCounts, setActiveContactCounts] = useState({});

    // Test email parameters
    const [testEmail, setTestEmail] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testEmailSuccess, setTestEmailSuccess] = useState('');
    const [testEmailError, setTestEmailError] = useState('');

    // Warmup parameters
    const [initialBatchSize, setInitialBatchSize] = useState(50);
    const [incrementFactor, setIncrementFactor] = useState(2);
    const [incrementInterval, setIncrementInterval] = useState(24);
    const [maxBatchSize, setMaxBatchSize] = useState(10000);
    const [warmupStartDate, setWarmupStartDate] = useState(new Date());
    const [warmupStartTime, setWarmupStartTime] = useState(new Date());
    const [estimatedWarmupDuration, setEstimatedWarmupDuration] = useState(null);
    const [warmupStages, setWarmupStages] = useState([]);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
            return;
        }

        if (status === 'authenticated' && id && campaignId) {
            fetchBrandDetails();
            fetchCampaignDetails();
            fetchContactLists();
        }
    }, [status, id, campaignId, router]);

    // Set test email to user's email by default
    useEffect(() => {
        if (session?.user?.email) {
            setTestEmail(session.user.email);
        }
    }, [session]);

    // Calculate total active contacts when selected lists change
    useEffect(() => {
        const fetchActiveContactCounts = async () => {
            if (selectedLists.length === 0) {
                setTotalContacts(0);
                return;
            }

            try {
                const res = await fetch(`/api/brands/${id}/contact-lists/active-counts?listIds=${selectedLists.join(',')}`, {
                    credentials: 'same-origin',
                });

                if (!res.ok) {
                    throw new Error('Failed to fetch active contact counts');
                }

                const counts = await res.json();
                let total = 0;

                for (const listId of selectedLists) {
                    total += counts[listId] || 0;
                }

                setTotalContacts(total);
            } catch (error) {
                console.error('Error fetching active contact counts:', error);
                // Fallback to using the cached active counts
                let total = 0;
                selectedLists.forEach((listId) => {
                    total += activeContactCounts[listId] || 0;
                });
                setTotalContacts(total);
            }
        };

        fetchActiveContactCounts();
    }, [selectedLists, id, activeContactCounts]);

    // Calculate warmup stages and duration when warmup parameters change
    useEffect(() => {
        if (scheduleType === 'warmup' && totalContacts > 0) {
            calculateWarmupSchedule();
        }
    }, [scheduleType, initialBatchSize, incrementFactor, incrementInterval, maxBatchSize, totalContacts]);

    const calculateWarmupSchedule = () => {
        if (totalContacts <= 0) return;

        const stages = [];
        let currentBatchSize = initialBatchSize;
        let totalSent = 0;
        let stageCount = 0;
        let cumulativeDays = 0;
        const intervalInDays = incrementInterval / 24;

        while (totalSent < totalContacts) {
            // Make sure we don't exceed total contacts in the final batch
            const stageBatchSize = Math.min(currentBatchSize, totalContacts - totalSent);

            stages.push({
                stage: stageCount,
                batchSize: stageBatchSize,
                totalSent: totalSent + stageBatchSize,
                day: cumulativeDays,
                date: new Date(warmupStartDate.getTime() + cumulativeDays * 24 * 60 * 60 * 1000),
            });

            totalSent += stageBatchSize;
            stageCount++;
            cumulativeDays += intervalInDays;

            // Calculate next batch size according to warmup formula
            currentBatchSize = Math.min(Math.floor(initialBatchSize * Math.pow(incrementFactor, stageCount)), maxBatchSize);

            // If we're already at max batch size and still have more to send,
            // we can predict how many more batches at max size
            if (currentBatchSize === maxBatchSize && totalSent < totalContacts) {
                const remainingContacts = totalContacts - totalSent;
                const fullBatchesRemaining = Math.floor(remainingContacts / maxBatchSize);

                // Add full batches
                for (let i = 0; i < fullBatchesRemaining; i++) {
                    totalSent += maxBatchSize;
                    stageCount++;
                    cumulativeDays += intervalInDays;

                    stages.push({
                        stage: stageCount,
                        batchSize: maxBatchSize,
                        totalSent: totalSent,
                        day: cumulativeDays,
                        date: new Date(warmupStartDate.getTime() + cumulativeDays * 24 * 60 * 60 * 1000),
                    });
                }

                // Add final partial batch if needed
                const finalBatchSize = remainingContacts % maxBatchSize;
                if (finalBatchSize > 0) {
                    stageCount++;
                    cumulativeDays += intervalInDays;
                    totalSent += finalBatchSize;

                    stages.push({
                        stage: stageCount,
                        batchSize: finalBatchSize,
                        totalSent: totalSent,
                        day: cumulativeDays,
                        date: new Date(warmupStartDate.getTime() + cumulativeDays * 24 * 60 * 60 * 1000),
                    });
                }

                // Break since we've calculated all stages
                break;
            }
        }

        setWarmupStages(stages);
        setEstimatedWarmupDuration(Math.ceil(cumulativeDays));
    };

    const fetchBrandDetails = async () => {
        try {
            const res = await fetch(`/api/brands/${id}`, {
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
        }
    };

    const fetchCampaignDetails = async () => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error('Campaign not found');
                } else {
                    const data = await res.json();
                    throw new Error(data.message || 'Failed to fetch campaign details');
                }
            }

            const data = await res.json();
            setCampaign(data);

            // Verify this is a draft campaign
            if (data.status !== 'draft') {
                setError('This campaign has already been sent or scheduled.');
            }
        } catch (error) {
            console.error('Error fetching campaign details:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchContactLists = async () => {
        try {
            setIsLoadingLists(true);
            const res = await fetch(`/api/brands/${id}/contact-lists`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch contact lists');
            }

            const data = await res.json();
            // Only show lists with contacts
            const listsWithContacts = data.filter((list) => list.contactCount > 0);
            setContactLists(listsWithContacts);

            // Fetch active contact counts for all lists
            if (listsWithContacts.length > 0) {
                await fetchActiveContactCounts(listsWithContacts);
            }
        } catch (error) {
            console.error('Error fetching contact lists:', error);
            setError(error.message);
        } finally {
            setIsLoadingLists(false);
        }
    };

    // Fetch active contact counts for all lists
    const fetchActiveContactCounts = async (lists) => {
        if (!lists || lists.length === 0) return;

        try {
            const res = await fetch(`/api/brands/${id}/contact-lists/active-counts?listIds=${lists.map((l) => l._id).join(',')}`, {
                credentials: 'same-origin',
            });

            if (!res.ok) {
                throw new Error('Failed to fetch active contact counts');
            }

            const counts = await res.json();
            setActiveContactCounts(counts);
        } catch (error) {
            console.error('Error fetching active contact counts:', error);
        }
    };

    const handleToggleList = (listId) => {
        if (selectedLists.includes(listId)) {
            setSelectedLists(selectedLists.filter((id) => id !== listId));
        } else {
            setSelectedLists([...selectedLists, listId]);
        }
    };

    const handleSendTestEmail = async () => {
        if (!testEmail) {
            setTestEmailError('Please enter an email address');
            return;
        }

        try {
            setIsSendingTest(true);
            setTestEmailError('');
            setTestEmailSuccess('');

            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: testEmail,
                    fromName: brand.fromName,
                    fromEmail: brand.fromEmail,
                    replyTo: brand.replyToEmail,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to send test email');
            }

            setTestEmailSuccess('Test email sent successfully!');
            setTimeout(() => setTestEmailSuccess(''), 3000);
        } catch (error) {
            console.error('Error sending test email:', error);
            setTestEmailError(error.message);
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleSendButtonClick = () => {
        // First validate the form
        if (selectedLists.length === 0) {
            setError('Please select at least one contact list');
            return;
        }

        if (scheduleType === 'schedule' && !isValidScheduledDateTime()) {
            setError('Please select a future date and time for scheduling');
            return;
        }

        if (scheduleType === 'warmup' && !isValidWarmupConfig()) {
            return;
        }

        // Check if there are active contacts
        if (totalContacts === 0) {
            setError('Selected lists have no active contacts to send to');
            return;
        }

        // Show confirmation modal
        setShowConfirmModal(true);
    };

    const handleSendCampaign = async () => {
        setShowConfirmModal(false);
        setIsSending(true);
        setError('');
        setSuccess('');

        try {
            // Prepare scheduled datetime if needed
            let scheduledAt = null;
            if (scheduleType === 'schedule') {
                // Combine date and time
                const combinedDate = new Date(scheduledDate);
                combinedDate.setHours(scheduledTime.getHours());
                combinedDate.setMinutes(scheduledTime.getMinutes());
                scheduledAt = combinedDate.toISOString();
            }

            // Prepare warmup config if needed
            let warmupConfig = null;
            if (scheduleType === 'warmup') {
                // Combine date and time for warmup start
                const warmupStartDateTime = new Date(warmupStartDate);
                warmupStartDateTime.setHours(warmupStartTime.getHours());
                warmupStartDateTime.setMinutes(warmupStartTime.getMinutes());

                warmupConfig = {
                    initialBatchSize,
                    incrementFactor,
                    incrementInterval,
                    maxBatchSize,
                    warmupStartDate: warmupStartDateTime.toISOString(),
                };
            }

            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Include all necessary campaign data
                    status: scheduleType === 'schedule' ? 'scheduled' : scheduleType === 'warmup' ? null : 'sending',
                    scheduleType,
                    scheduledAt,
                    warmupConfig,
                    contactListIds: selectedLists,
                    fromName: brand.fromName,
                    fromEmail: brand.fromEmail,
                    replyTo: brand.replyToEmail,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to update campaign');
            }

            const successMessage = scheduleType === 'send_now' ? 'Campaign is being sent!' : scheduleType === 'schedule' ? 'Campaign has been scheduled!' : 'Campaign warmup has been started!';

            setSuccess(successMessage);

            // Redirect back to campaign after short delay
            setTimeout(() => {
                router.push(`/brands/${id}/campaigns/${campaignId}`);
            }, 2000);
        } catch (error) {
            console.error('Error sending campaign:', error);
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setIsSending(false);
        }
    };

    const isValidScheduledDateTime = () => {
        // Combine date and time
        const combinedDate = new Date(scheduledDate);
        combinedDate.setHours(scheduledTime.getHours());
        combinedDate.setMinutes(scheduledTime.getMinutes());

        // Compare with current time
        return combinedDate > new Date();
    };

    const isValidWarmupConfig = () => {
        let isValid = true;

        if (initialBatchSize <= 0) {
            setError('Initial batch size must be greater than 0');
            isValid = false;
        }

        if (incrementFactor <= 1) {
            setError('Increment factor must be greater than 1');
            isValid = false;
        }

        if (incrementInterval <= 0) {
            setError('Increment interval must be greater than 0');
            isValid = false;
        }

        if (maxBatchSize <= initialBatchSize) {
            setError('Maximum batch size must be greater than initial batch size');
            isValid = false;
        }

        const warmupDateTime = new Date(warmupStartDate);
        warmupDateTime.setHours(warmupStartTime.getHours());
        warmupDateTime.setMinutes(warmupStartTime.getMinutes());

        if (warmupDateTime <= new Date()) {
            setError('Warmup start time must be in the future');
            isValid = false;
        }

        return isValid;
    };

    const isBrandReadyToSend = () => {
        return !(brand.status === 'pending_setup' || brand.status === 'pending_verification');
    };

    // Format number for display in confirmation modal
    const formatNumber = (num) => {
        return new Intl.NumberFormat().format(num);
    };

    // Format date for display
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (isLoading || !brand || !campaign) {
        return (
            <BrandLayout brand={brand}>
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Loading campaign details...</p>
                </div>
            </BrandLayout>
        );
    }

    return (
        <BrandLayout brand={brand}>
            <div className="sc-container">
                <div className="sc-header">
                    <Link
                        href={`/brands/${id}/campaigns/${campaignId}`}
                        className="sc-back-link"
                    >
                        <ArrowLeft size={16} />
                        <span>Back to campaign</span>
                    </Link>
                    <h1>Send Campaign</h1>
                </div>

                {error && (
                    <div className="sc-alert sc-alert-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="sc-alert sc-alert-success">
                        <CheckCircle size={16} />
                        <span>{success}</span>
                    </div>
                )}

                {!isBrandReadyToSend() && (
                    <div className="sc-verification-alert">
                        <AlertCircle size={16} />
                        <span>{brand.status === 'pending_setup' ? 'You need to complete brand setup before sending campaigns.' : 'Your brand is pending verification. Please verify your domain and email sending settings first.'}</span>
                    </div>
                )}

                {/* Main Two-Column Layout */}
                <div className="sc-main-layout">
                    {/* LEFT COLUMN - PREVIEW */}
                    <div className="sc-preview-column">
                        {/* Campaign Details & Preview Card */}
                        <div className="sc-card sc-card-compact sc-sticky">
                            <div className="sc-card-header">
                                <Mail size={16} />
                                <h2>Campaign Preview</h2>
                            </div>

                            {/* Campaign Details */}
                            <div className="sc-card-content">
                                <div className="sc-details-grid">
                                    <div className="sc-detail-item">
                                        <span className="sc-detail-label">Name</span>
                                        <span className="sc-detail-value">{campaign.name}</span>
                                    </div>
                                    <div className="sc-detail-item">
                                        <span className="sc-detail-label">Subject</span>
                                        <span className="sc-detail-value">{campaign.subject}</span>
                                    </div>
                                    <div className="sc-detail-item">
                                        <span className="sc-detail-label">From</span>
                                        <span className="sc-detail-value">
                                            {campaign.fromName || brand.name} &lt;{campaign.fromEmail || brand.fromEmail || 'Not set'}&gt;
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Email Preview */}
                            <div
                                className="sc-card-content"
                                style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid oklch(0.95 0 0)' }}
                            >
                                <div className="sc-preview-wrapper">
                                    <div className="sc-preview-label">Email Content</div>
                                    <div
                                        className="sc-email-preview"
                                        dangerouslySetInnerHTML={{
                                            __html: campaign.content || '<p style="color: #999;">No content yet. Go back and edit your campaign to add content.</p>',
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Test Email Section */}
                            <div
                                className="sc-card-content"
                                style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid oklch(0.95 0 0)' }}
                            >
                                <div className="sc-test-email-section">
                                    <div className="sc-test-email-header">
                                        <span className="sc-preview-label">Send Test Email</span>
                                        {testEmailSuccess && (
                                            <span className="sc-test-success">
                                                <CheckCircle size={14} />
                                                Sent!
                                            </span>
                                        )}
                                    </div>

                                    {testEmailError && (
                                        <div className="sc-test-error">
                                            <AlertCircle size={14} />
                                            <span>{testEmailError}</span>
                                        </div>
                                    )}

                                    <div className="sc-test-email-form">
                                        <input
                                            type="email"
                                            className="form-input form-input--small"
                                            placeholder="your@email.com"
                                            value={testEmail}
                                            onChange={(e) => setTestEmail(e.target.value)}
                                        />
                                        <button
                                            className="button button--small button--secondary"
                                            onClick={handleSendTestEmail}
                                            disabled={isSendingTest || !testEmail}
                                        >
                                            {isSendingTest ? (
                                                <>
                                                    <span className="spinner-icon">⟳</span>
                                                    <span>Sending...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={14} />
                                                    <span>Send Test</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="sc-test-help">Test emails help you verify how your campaign looks before sending to all recipients.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - OPTIONS */}
                    <div className="sc-options-column">
                        {/* Recipients Card */}
                        <div className="sc-card sc-card-compact">
                            <div className="sc-card-header">
                                <Users size={16} />
                                <h2>Recipients</h2>
                            </div>
                            <div className="sc-card-content">
                                {isLoadingLists ? (
                                    <div className="sc-loading">
                                        <div className="sc-spinner"></div>
                                        <p>Loading contact lists...</p>
                                    </div>
                                ) : (
                                    <>
                                        {contactLists.length === 0 ? (
                                            <div className="sc-empty">
                                                <p>You don&apos;t have any contact lists with contacts.</p>
                                                <Link
                                                    href={`/brands/${id}/contacts`}
                                                    className="button button--primary button--small"
                                                >
                                                    Create Contact List
                                                </Link>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="sc-lists">
                                                    {contactLists.map((list) => (
                                                        <label
                                                            key={list._id}
                                                            className={`sc-list-item ${selectedLists.includes(list._id) ? 'sc-selected' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedLists.includes(list._id)}
                                                                onChange={() => handleToggleList(list._id)}
                                                                className="form-checkbox"
                                                            />
                                                            <div className="sc-list-info">
                                                                <span className="sc-list-name">{list.name}</span>
                                                                <span className="sc-list-count">
                                                                    {activeContactCounts[list._id] || 0} active
                                                                    {list.contactCount > (activeContactCounts[list._id] || 0) && ` (${list.contactCount} total)`}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>

                                                {selectedLists.length > 0 && (
                                                    <div className="sc-summary">
                                                        <Users size={14} />
                                                        <span>
                                                            <strong>{totalContacts}</strong> active contacts in {selectedLists.length} list
                                                            {selectedLists.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Send Options Card */}
                        <div className="sc-card sc-card-compact">
                            <div className="sc-card-header">
                                <Calendar size={16} />
                                <h2>Send Options</h2>
                            </div>
                            <div className="sc-card-content">
                                <div className="sc-schedule-options">
                                    {/* Send Now Option */}
                                    <label className={`sc-option ${scheduleType === 'send_now' ? 'sc-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="scheduleType"
                                            checked={scheduleType === 'send_now'}
                                            onChange={() => setScheduleType('send_now')}
                                            className="form-radio"
                                        />
                                        <div className="sc-option-content">
                                            <Send size={16} />
                                            <div className="sc-option-info">
                                                <span className="sc-option-title">Send Now</span>
                                                <span className="sc-option-desc">Send immediately to all recipients</span>
                                            </div>
                                        </div>
                                    </label>

                                    {/* Schedule for Later Option */}
                                    <label className={`sc-option ${scheduleType === 'schedule' ? 'sc-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="scheduleType"
                                            checked={scheduleType === 'schedule'}
                                            onChange={() => setScheduleType('schedule')}
                                            className="form-radio"
                                        />
                                        <div className="sc-option-content">
                                            <Calendar size={16} />
                                            <div className="sc-option-info">
                                                <span className="sc-option-title">Schedule for Later</span>
                                                <span className="sc-option-desc">Choose a specific date and time</span>
                                            </div>
                                        </div>
                                    </label>

                                    {/* Domain Warmup Option */}
                                    <label className={`sc-option ${scheduleType === 'warmup' ? 'sc-selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="scheduleType"
                                            checked={scheduleType === 'warmup'}
                                            onChange={() => setScheduleType('warmup')}
                                            className="form-radio"
                                        />
                                        <div className="sc-option-content">
                                            <Droplet size={16} />
                                            <div className="sc-option-info">
                                                <span className="sc-option-title">Domain Warmup</span>
                                                <span className="sc-option-desc">Gradually increase sending volume</span>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Schedule Options */}
                                {scheduleType === 'schedule' && (
                                    <div className="sc-schedule-config">
                                        <div className="date-time-selection">
                                            <div className="date-picker-wrapper">
                                                <label>Date</label>
                                                <DatePicker
                                                    selected={scheduledDate}
                                                    onChange={(date) => setScheduledDate(date)}
                                                    minDate={new Date()}
                                                    className="date-picker"
                                                />
                                            </div>
                                            <div className="time-picker-wrapper">
                                                <label>Time</label>
                                                <DatePicker
                                                    selected={scheduledTime}
                                                    onChange={(time) => setScheduledTime(time)}
                                                    showTimeSelect
                                                    showTimeSelectOnly
                                                    timeIntervals={15}
                                                    timeCaption="Time"
                                                    dateFormat="h:mm aa"
                                                    className="time-picker"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Warmup Options */}
                                {scheduleType === 'warmup' && (
                                    <div className="sc-warmup-options">
                                        <div className="sc-info-box">
                                            <Info size={14} />
                                            <span>Domain warmup gradually increases email volume to build sender reputation and improve deliverability.</span>
                                        </div>

                                        <div className="sc-warmup-config">
                                            <div className="sc-warmup-form">
                                                <div className="sc-form-row">
                                                    <div className="form-group">
                                                        <label className="form-label">Initial Batch</label>
                                                        <input
                                                            type="number"
                                                            value={initialBatchSize}
                                                            onChange={(e) => setInitialBatchSize(Math.max(1, parseInt(e.target.value)))}
                                                            min="1"
                                                            className="form-input"
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label className="form-label">Growth Factor</label>
                                                        <input
                                                            type="number"
                                                            value={incrementFactor}
                                                            onChange={(e) => setIncrementFactor(Math.max(1.1, parseFloat(e.target.value)))}
                                                            step="0.1"
                                                            min="1.1"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="sc-form-row">
                                                    <div className="form-group">
                                                        <label className="form-label">Interval (hours)</label>
                                                        <input
                                                            type="number"
                                                            value={incrementInterval}
                                                            onChange={(e) => setIncrementInterval(Math.max(1, parseInt(e.target.value)))}
                                                            min="1"
                                                            className="form-input"
                                                        />
                                                    </div>

                                                    <div className="form-group">
                                                        <label className="form-label">Max Batch</label>
                                                        <input
                                                            type="number"
                                                            value={maxBatchSize}
                                                            onChange={(e) => setMaxBatchSize(Math.max(initialBatchSize, parseInt(e.target.value)))}
                                                            min={initialBatchSize}
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="date-time-selection">
                                                    <div className="date-picker-wrapper">
                                                        <label>Start Date</label>
                                                        <DatePicker
                                                            selected={warmupStartDate}
                                                            onChange={(date) => setWarmupStartDate(date)}
                                                            minDate={new Date()}
                                                            className="date-picker"
                                                        />
                                                    </div>
                                                    <div className="time-picker-wrapper">
                                                        <label>Start Time</label>
                                                        <DatePicker
                                                            selected={warmupStartTime}
                                                            onChange={(time) => setWarmupStartTime(time)}
                                                            showTimeSelect
                                                            showTimeSelectOnly
                                                            timeIntervals={15}
                                                            timeCaption="Time"
                                                            dateFormat="h:mm aa"
                                                            className="time-picker"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {warmupStages.length > 0 && (
                                            <div className="sc-warmup-schedule">
                                                <div className="sc-warmup-summary">
                                                    <div className="sc-warmup-stat">
                                                        <span className="sc-stat-value">{formatNumber(totalContacts)}</span>
                                                        <span className="sc-stat-label">Total Contacts</span>
                                                    </div>
                                                    <div className="sc-warmup-stat">
                                                        <span className="sc-stat-value">{estimatedWarmupDuration}d</span>
                                                        <span className="sc-stat-label">Duration</span>
                                                    </div>
                                                    <div className="sc-warmup-stat">
                                                        <span className="sc-stat-value">{warmupStages.length}</span>
                                                        <span className="sc-stat-label">Batches</span>
                                                    </div>
                                                </div>

                                                <div className="sc-warmup-stages-container">
                                                    <div className="sc-warmup-stages-header">
                                                        <span>Stage</span>
                                                        <span>Date</span>
                                                        <span>Size</span>
                                                        <span>Total</span>
                                                    </div>

                                                    <div className="sc-warmup-stages">
                                                        {warmupStages.slice(0, 4).map((stage) => (
                                                            <div
                                                                key={stage.stage}
                                                                className="sc-warmup-stage"
                                                            >
                                                                <span>#{stage.stage + 1}</span>
                                                                <span>{formatDate(stage.date)}</span>
                                                                <span>{formatNumber(stage.batchSize)}</span>
                                                                <span>{formatNumber(stage.totalSent)}</span>
                                                            </div>
                                                        ))}

                                                        {warmupStages.length > 4 && <div className="sc-warmup-more">+{warmupStages.length - 4} more stages</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sc-actions">
                            <Link
                                href={`/brands/${id}/campaigns/${campaignId}`}
                                className="sc-btn sc-btn-cancel"
                            >
                                Cancel
                            </Link>

                            <button
                                className="sc-btn sc-btn-send"
                                onClick={handleSendButtonClick}
                                disabled={isSending || selectedLists.length === 0 || totalContacts === 0 || !isBrandReadyToSend()}
                            >
                                {isSending ? (
                                    <>
                                        <div className="sc-spinner-btn"></div>
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        {scheduleType === 'warmup' ? <Droplet size={18} /> : <Send size={18} />}
                                        <span>{scheduleType === 'send_now' ? 'Send Campaign Now' : scheduleType === 'schedule' ? 'Schedule Campaign' : 'Start Domain Warmup'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="sc-modal-overlay">
                    <div className="sc-modal">
                        <div className="sc-modal-header">
                            <h3>{scheduleType === 'send_now' ? 'Confirm Campaign Send' : scheduleType === 'schedule' ? 'Confirm Campaign Schedule' : 'Confirm Domain Warmup'}</h3>
                            <button
                                className="sc-close-btn"
                                onClick={() => setShowConfirmModal(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="sc-modal-content">
                            <div className="sc-confirmation-message">
                                {scheduleType === 'warmup' ? (
                                    <Droplet
                                        size={40}
                                        className="warmup-icon"
                                    />
                                ) : (
                                    <Send
                                        size={40}
                                        className={scheduleType === 'send_now' ? 'send-icon' : 'schedule-icon'}
                                    />
                                )}

                                <p>
                                    {scheduleType === 'send_now'
                                        ? `You are about to send "${campaign.name}" to ${formatNumber(totalContacts)} contacts. This action cannot be undone.`
                                        : scheduleType === 'schedule'
                                        ? `You are about to schedule "${campaign.name}" to be sent to ${formatNumber(totalContacts)} contacts.`
                                        : `You are about to start a domain warmup for "${campaign.name}" that will gradually send to ${formatNumber(totalContacts)} contacts over approximately ${estimatedWarmupDuration} days.`}
                                </p>

                                <div className="sc-campaign-summary">
                                    <div className="sc-summary-item">
                                        <span className="sc-summary-label">Subject:</span>
                                        <span className="sc-summary-value">{campaign.subject}</span>
                                    </div>

                                    {scheduleType === 'schedule' && (
                                        <div className="sc-summary-item">
                                            <span className="sc-summary-label">Scheduled for:</span>
                                            <span className="sc-summary-value">
                                                {scheduledDate.toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                })}{' '}
                                                at{' '}
                                                {scheduledTime.toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    )}

                                    {scheduleType === 'warmup' && (
                                        <>
                                            <div className="sc-summary-item">
                                                <span className="sc-summary-label">Start date:</span>
                                                <span className="sc-summary-value">
                                                    {warmupStartDate.toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}{' '}
                                                    at{' '}
                                                    {warmupStartTime.toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <div className="sc-summary-item">
                                                <span className="sc-summary-label">First batch:</span>
                                                <span className="sc-summary-value">{formatNumber(initialBatchSize)} contacts</span>
                                            </div>
                                            <div className="sc-summary-item">
                                                <span className="sc-summary-label">Frequency:</span>
                                                <span className="sc-summary-value">Every {incrementInterval} hours</span>
                                            </div>
                                            <div className="sc-summary-item">
                                                <span className="sc-summary-label">Growth rate:</span>
                                                <span className="sc-summary-value">{incrementFactor}x per batch</span>
                                            </div>
                                        </>
                                    )}

                                    <div className="sc-summary-item">
                                        <span className="sc-summary-label">Recipients:</span>
                                        <span className="sc-summary-value">{formatNumber(totalContacts)} contacts</span>
                                    </div>
                                </div>

                                {scheduleType === 'warmup' && (
                                    <div className="sc-warmup-notice">
                                        <Info size={16} />
                                        <span>Warmup sends can be paused or cancelled from the campaign details page if needed.</span>
                                    </div>
                                )}
                            </div>
                            <div className="sc-modal-actions">
                                <button
                                    className="sc-btn sc-btn-secondary"
                                    onClick={() => setShowConfirmModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="sc-btn sc-btn-confirm"
                                    onClick={handleSendCampaign}
                                >
                                    {scheduleType === 'send_now' ? 'Send Now' : scheduleType === 'schedule' ? 'Schedule Campaign' : 'Start Warmup Process'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </BrandLayout>
    );
}
