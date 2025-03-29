import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import BrandLayout from '@/components/BrandLayout';
import { ArrowLeft, Send, Calendar, Clock, CheckCircle, Users, Mail, AlertCircle } from 'lucide-react';
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

    // Send parameters
    const [selectedLists, setSelectedLists] = useState([]);
    const [scheduleType, setScheduleType] = useState('send_now');
    const [scheduledDate, setScheduledDate] = useState(new Date());
    const [scheduledTime, setScheduledTime] = useState(new Date());
    const [totalContacts, setTotalContacts] = useState(0);

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

    // Calculate total contacts when selected lists change
    useEffect(() => {
        let total = 0;
        selectedLists.forEach((listId) => {
            const list = contactLists.find((list) => list._id === listId);
            if (list) {
                total += list.contactCount || 0;
            }
        });
        setTotalContacts(total);
    }, [selectedLists, contactLists]);

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
        } catch (error) {
            console.error('Error fetching contact lists:', error);
            setError(error.message);
        } finally {
            setIsLoadingLists(false);
        }
    };

    const handleToggleList = (listId) => {
        if (selectedLists.includes(listId)) {
            setSelectedLists(selectedLists.filter((id) => id !== listId));
        } else {
            setSelectedLists([...selectedLists, listId]);
        }
    };

    // Example code for your SendCampaign.js component
    const handleSendCampaign = async () => {
        if (selectedLists.length === 0) {
            setError('Please select at least one contact list');
            return;
        }

        if (scheduleType === 'schedule' && !isValidScheduledDateTime()) {
            setError('Please select a future date and time for scheduling');
            return;
        }

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

            const res = await fetch(`/api/brands/${id}/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // Include all necessary campaign data
                    status: scheduleType === 'schedule' ? 'scheduled' : 'sending',
                    scheduleType,
                    scheduledAt,
                    contactListIds: selectedLists,
                    fromName: brand.fromName,
                    fromEmail: brand.fromEmail,
                    replyTo: brand.replyToEmail,
                }),
                credentials: 'same-origin',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to send campaign');
            }

            setSuccess(scheduleType === 'send_now' ? 'Campaign is being sent!' : 'Campaign has been scheduled!');

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

    const isBrandReadyToSend = () => {
        return !(brand.status === 'pending_setup' || brand.status === 'pending_verification');
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
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="sc-alert sc-alert-success">
                        <CheckCircle size={20} />
                        <span>{success}</span>
                    </div>
                )}

                <div className="sc-card">
                    <div className="sc-card-header">
                        <Mail size={18} />
                        <h2>Campaign Details</h2>
                    </div>
                    <div className="sc-card-content">
                        <div className="sc-detail-row">
                            <div className="sc-detail-label">Name:</div>
                            <div className="sc-detail-value">{campaign.name}</div>
                        </div>
                        <div className="sc-detail-row">
                            <div className="sc-detail-label">Subject:</div>
                            <div className="sc-detail-value">{campaign.subject}</div>
                        </div>
                        <div className="sc-detail-row">
                            <div className="sc-detail-label">From:</div>
                            <div className="sc-detail-value">
                                {campaign.fromName || brand.name} &lt;{campaign.fromEmail || brand.fromEmail || 'Not set'}&gt;
                            </div>
                        </div>
                    </div>
                </div>

                <div className="sc-card">
                    <div className="sc-card-header">
                        <Mail size={18} />
                        <h2>Email Preview</h2>
                    </div>
                    <div className="sc-card-content">
                        <div
                            className="sc-email-preview"
                            dangerouslySetInnerHTML={{ __html: campaign.content || '<p>No content yet. Go back and edit your campaign to add content.</p>' }}
                        ></div>
                    </div>
                </div>

                <div className="sc-card">
                    <div className="sc-card-header">
                        <Users size={18} />
                        <h2>Select Recipients</h2>
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
                                        <p>You don't have any contact lists with contacts. Please create a contact list and add contacts first.</p>
                                        <Link
                                            href={`/brands/${id}/contacts`}
                                            className="sc-btn sc-btn-primary"
                                        >
                                            Create Contact List
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        <div className="sc-lists">
                                            {contactLists.map((list) => (
                                                <div
                                                    key={list._id}
                                                    className={`sc-list-item ${selectedLists.includes(list._id) ? 'sc-selected' : ''}`}
                                                    onClick={() => handleToggleList(list._id)}
                                                >
                                                    <div className="sc-checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedLists.includes(list._id)}
                                                            onChange={() => {}}
                                                            id={`list-${list._id}`}
                                                        />
                                                    </div>
                                                    <div className="sc-list-info">
                                                        <h4>{list.name}</h4>
                                                        <p>{list.contactCount} contacts</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {selectedLists.length > 0 && (
                                            <div className="sc-summary">
                                                <Users size={16} />
                                                <span>
                                                    Sending to <strong>{totalContacts}</strong> contacts across {selectedLists.length} list{selectedLists.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="sc-card">
                    <div className="sc-card-header">
                        <Calendar size={18} />
                        <h2>Choose When to Send</h2>
                    </div>
                    <div className="sc-card-content">
                        <div className="sc-schedule-options">
                            <div
                                className={`sc-option ${scheduleType === 'send_now' ? 'sc-selected' : ''}`}
                                onClick={() => setScheduleType('send_now')}
                            >
                                <div className="sc-radio">
                                    <input
                                        type="radio"
                                        checked={scheduleType === 'send_now'}
                                        onChange={() => {}}
                                        id="send-now"
                                    />
                                </div>
                                <div className="sc-option-content">
                                    <Send size={18} />
                                    <div className="sc-option-info">
                                        <h4>Send Now</h4>
                                        <p>Your campaign will be sent immediately</p>
                                    </div>
                                </div>
                            </div>

                            <div
                                className={`sc-option ${scheduleType === 'schedule' ? 'sc-selected' : ''}`}
                                onClick={() => setScheduleType('schedule')}
                            >
                                <div className="sc-radio">
                                    <input
                                        type="radio"
                                        checked={scheduleType === 'schedule'}
                                        onChange={() => {}}
                                        id="schedule"
                                    />
                                </div>
                                <div className="sc-option-content">
                                    <Calendar size={18} />
                                    <div className="sc-option-info">
                                        <h4>Schedule for Later</h4>
                                        <p>Select a date and time to send this campaign</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {scheduleType === 'schedule' && (
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
                        )}
                    </div>
                </div>

                {!isBrandReadyToSend() && (
                    <div className="sc-verification-alert">
                        <AlertCircle size={16} />
                        <span>{brand.status === 'pending_setup' ? 'You need to complete brand setup before sending campaigns.' : 'Your brand is pending verification. Please verify your domain and email sending settings first.'}</span>
                    </div>
                )}

                <div className="sc-actions">
                    <Link
                        href={`/brands/${id}/campaigns/${campaignId}`}
                        className="sc-btn sc-btn-cancel"
                    >
                        Cancel
                    </Link>

                    <button
                        className="sc-btn sc-btn-send"
                        onClick={handleSendCampaign}
                        disabled={isSending || selectedLists.length === 0 || !isBrandReadyToSend()}
                    >
                        {isSending ? (
                            <>
                                <div className="sc-spinner-btn"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                <span>{scheduleType === 'send_now' ? 'Send Campaign Now' : 'Schedule Campaign'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </BrandLayout>
    );
}
