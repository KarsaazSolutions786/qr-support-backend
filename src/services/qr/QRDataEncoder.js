/**
 * QRDataEncoder - Handles encoding of all QR code data types
 *
 * Supports all the same types as Laravel backend:
 * - URL, Text, Email, Phone, SMS, WiFi, vCard, Location
 * - Event/iCal, WhatsApp, Social Links, Crypto, UPI/PIX
 */
class QRDataEncoder {
    /**
     * Supported QR code types
     */
    static TYPES = {
        URL: 'url',
        TEXT: 'text',
        EMAIL: 'email',
        PHONE: 'phone',
        SMS: 'sms',
        WIFI: 'wifi',
        VCARD: 'vcard',
        LOCATION: 'location',
        EVENT: 'event',
        WHATSAPP: 'whatsapp',
        SOCIAL: 'social',
        CRYPTO: 'crypto',
        UPI: 'upi',
        PIX: 'pix',
    };

    /**
     * Encode data based on QR type
     *
     * @param {string} type - QR code type
     * @param {Object} data - Data to encode
     * @returns {string} - Encoded QR content string
     */
    static encode(type, data) {
        if (!type || !data) {
            throw new Error('Type and data are required for encoding');
        }

        const normalizedType = type.toLowerCase();
        const encoder = this.getEncoder(normalizedType);

        if (!encoder) {
            // If no specific encoder, treat as text
            return typeof data === 'string' ? data : JSON.stringify(data);
        }

        return encoder(data);
    }

    /**
     * Get the encoder function for a specific type
     *
     * @param {string} type - QR code type
     * @returns {Function|null} - Encoder function or null
     */
    static getEncoder(type) {
        const encoders = {
            [this.TYPES.URL]: this.encodeUrl.bind(this),
            [this.TYPES.TEXT]: this.encodeText.bind(this),
            [this.TYPES.EMAIL]: this.encodeEmail.bind(this),
            [this.TYPES.PHONE]: this.encodePhone.bind(this),
            [this.TYPES.SMS]: this.encodeSms.bind(this),
            [this.TYPES.WIFI]: this.encodeWifi.bind(this),
            [this.TYPES.VCARD]: this.encodeVCard.bind(this),
            [this.TYPES.LOCATION]: this.encodeLocation.bind(this),
            [this.TYPES.EVENT]: this.encodeEvent.bind(this),
            [this.TYPES.WHATSAPP]: this.encodeWhatsApp.bind(this),
            [this.TYPES.SOCIAL]: this.encodeSocial.bind(this),
            [this.TYPES.CRYPTO]: this.encodeCrypto.bind(this),
            [this.TYPES.UPI]: this.encodeUpi.bind(this),
            [this.TYPES.PIX]: this.encodePix.bind(this),
        };

        return encoders[type] || null;
    }

    /**
     * Encode URL
     * @param {Object|string} data - URL data
     * @returns {string}
     */
    static encodeUrl(data) {
        if (typeof data === 'string') {
            return this.ensureValidUrl(data);
        }
        return this.ensureValidUrl(data.url || data.value || '');
    }

    /**
     * Ensure URL has a valid protocol
     * @param {string} url
     * @returns {string}
     */
    static ensureValidUrl(url) {
        if (!url) return '';
        url = url.trim();
        if (!url.match(/^https?:\/\//i)) {
            return `https://${url}`;
        }
        return url;
    }

    /**
     * Encode plain text
     * @param {Object|string} data - Text data
     * @returns {string}
     */
    static encodeText(data) {
        if (typeof data === 'string') {
            return data;
        }
        return data.text || data.value || data.content || '';
    }

    /**
     * Encode email (mailto:)
     * @param {Object} data - Email data
     * @returns {string}
     */
    static encodeEmail(data) {
        const email = data.email || data.to || '';
        const subject = data.subject || '';
        const body = data.body || data.message || '';
        const cc = data.cc || '';
        const bcc = data.bcc || '';

        let mailto = `mailto:${encodeURIComponent(email)}`;
        const params = [];

        if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
        if (body) params.push(`body=${encodeURIComponent(body)}`);
        if (cc) params.push(`cc=${encodeURIComponent(cc)}`);
        if (bcc) params.push(`bcc=${encodeURIComponent(bcc)}`);

        if (params.length > 0) {
            mailto += `?${params.join('&')}`;
        }

        return mailto;
    }

    /**
     * Encode phone number (tel:)
     * @param {Object|string} data - Phone data
     * @returns {string}
     */
    static encodePhone(data) {
        const phone = typeof data === 'string' ? data : (data.phone || data.number || data.tel || '');
        // Clean phone number - remove spaces, dashes, parentheses
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
        return `tel:${cleanPhone}`;
    }

    /**
     * Encode SMS
     * @param {Object} data - SMS data
     * @returns {string}
     */
    static encodeSms(data) {
        const phone = data.phone || data.number || '';
        const message = data.message || data.body || '';

        // Clean phone number
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');

        if (message) {
            return `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
        }
        return `sms:${cleanPhone}`;
    }

    /**
     * Encode WiFi credentials
     * Format: WIFI:T:<encryption>;S:<ssid>;P:<password>;H:<hidden>;;
     * @param {Object} data - WiFi data
     * @returns {string}
     */
    static encodeWifi(data) {
        const ssid = data.ssid || data.network || '';
        const password = data.password || data.pass || '';
        const encryption = (data.encryption || data.security || 'WPA').toUpperCase();
        const hidden = data.hidden || data.isHidden || false;

        // Escape special characters in SSID and password
        const escapedSsid = this.escapeWifiString(ssid);
        const escapedPassword = this.escapeWifiString(password);

        let wifiString = `WIFI:T:${encryption};S:${escapedSsid};`;

        if (password && encryption !== 'NOPASS') {
            wifiString += `P:${escapedPassword};`;
        }

        wifiString += `H:${hidden ? 'true' : 'false'};;`;

        return wifiString;
    }

    /**
     * Escape special characters for WiFi QR codes
     * @param {string} str
     * @returns {string}
     */
    static escapeWifiString(str) {
        if (!str) return '';
        // Escape special characters: \ ; , : "
        return str.replace(/([\\;,:"'])/g, '\\$1');
    }

    /**
     * Encode vCard (contact)
     * Supports both vCard 3.0 and 4.0
     * @param {Object} data - Contact data
     * @returns {string}
     */
    static encodeVCard(data) {
        const version = data.version || '3.0';
        const lines = [];

        lines.push('BEGIN:VCARD');
        lines.push(`VERSION:${version}`);

        // Full name (required)
        const fullName = this.buildFullName(data);
        lines.push(`FN:${this.escapeVCardValue(fullName)}`);

        // Structured name
        const lastName = data.lastName || data.surname || data.family_name || '';
        const firstName = data.firstName || data.given_name || data.name || '';
        const middleName = data.middleName || data.middle_name || '';
        const prefix = data.prefix || data.title || '';
        const suffix = data.suffix || '';
        lines.push(`N:${this.escapeVCardValue(lastName)};${this.escapeVCardValue(firstName)};${this.escapeVCardValue(middleName)};${this.escapeVCardValue(prefix)};${this.escapeVCardValue(suffix)}`);

        // Organization
        if (data.organization || data.company || data.org) {
            const org = data.organization || data.company || data.org;
            const department = data.department || '';
            if (department) {
                lines.push(`ORG:${this.escapeVCardValue(org)};${this.escapeVCardValue(department)}`);
            } else {
                lines.push(`ORG:${this.escapeVCardValue(org)}`);
            }
        }

        // Job title
        if (data.title || data.jobTitle || data.job_title) {
            lines.push(`TITLE:${this.escapeVCardValue(data.title || data.jobTitle || data.job_title)}`);
        }

        // Phone numbers
        this.addVCardPhones(data, lines, version);

        // Email addresses
        this.addVCardEmails(data, lines, version);

        // Website/URL
        if (data.website || data.url || data.web) {
            lines.push(`URL:${data.website || data.url || data.web}`);
        }

        // Address
        this.addVCardAddress(data, lines, version);

        // Birthday
        if (data.birthday || data.bday) {
            const bday = data.birthday || data.bday;
            // Format: YYYYMMDD or YYYY-MM-DD
            const formattedBday = bday.replace(/-/g, '');
            lines.push(`BDAY:${formattedBday}`);
        }

        // Note
        if (data.note || data.notes) {
            lines.push(`NOTE:${this.escapeVCardValue(data.note || data.notes)}`);
        }

        // Photo (base64 encoded)
        if (data.photo || data.image) {
            const photo = data.photo || data.image;
            if (photo.startsWith('data:image')) {
                // Extract base64 data
                const base64Data = photo.split(',')[1];
                const mimeType = photo.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
                const type = mimeType.split('/')[1].toUpperCase();
                lines.push(`PHOTO;ENCODING=b;TYPE=${type}:${base64Data}`);
            } else if (photo.startsWith('http')) {
                lines.push(`PHOTO;VALUE=uri:${photo}`);
            }
        }

        // Social profiles
        this.addVCardSocialProfiles(data, lines);

        lines.push('END:VCARD');

        return lines.join('\r\n');
    }

    /**
     * Build full name from parts
     * @param {Object} data
     * @returns {string}
     */
    static buildFullName(data) {
        if (data.fullName || data.full_name) {
            return data.fullName || data.full_name;
        }

        const parts = [];
        if (data.prefix || data.title) parts.push(data.prefix || data.title);
        if (data.firstName || data.given_name || data.name) parts.push(data.firstName || data.given_name || data.name);
        if (data.middleName || data.middle_name) parts.push(data.middleName || data.middle_name);
        if (data.lastName || data.surname || data.family_name) parts.push(data.lastName || data.surname || data.family_name);
        if (data.suffix) parts.push(data.suffix);

        return parts.filter(Boolean).join(' ') || 'Unknown';
    }

    /**
     * Add phone numbers to vCard
     * @param {Object} data
     * @param {Array} lines
     * @param {string} version
     */
    static addVCardPhones(data, lines, version) {
        const phones = data.phones || [];

        // Handle single phone fields
        if (data.phone || data.mobile || data.cell) {
            const phone = data.phone || data.mobile || data.cell;
            if (version === '4.0') {
                lines.push(`TEL;TYPE=cell;VALUE=uri:tel:${phone.replace(/[\s\-\(\)\.]/g, '')}`);
            } else {
                lines.push(`TEL;TYPE=CELL:${phone}`);
            }
        }

        if (data.work_phone || data.workPhone) {
            const phone = data.work_phone || data.workPhone;
            if (version === '4.0') {
                lines.push(`TEL;TYPE=work;VALUE=uri:tel:${phone.replace(/[\s\-\(\)\.]/g, '')}`);
            } else {
                lines.push(`TEL;TYPE=WORK:${phone}`);
            }
        }

        if (data.home_phone || data.homePhone) {
            const phone = data.home_phone || data.homePhone;
            if (version === '4.0') {
                lines.push(`TEL;TYPE=home;VALUE=uri:tel:${phone.replace(/[\s\-\(\)\.]/g, '')}`);
            } else {
                lines.push(`TEL;TYPE=HOME:${phone}`);
            }
        }

        if (data.fax) {
            if (version === '4.0') {
                lines.push(`TEL;TYPE=fax;VALUE=uri:tel:${data.fax.replace(/[\s\-\(\)\.]/g, '')}`);
            } else {
                lines.push(`TEL;TYPE=FAX:${data.fax}`);
            }
        }

        // Handle phones array
        for (const phoneObj of phones) {
            const phone = phoneObj.number || phoneObj.phone || phoneObj.value;
            const type = (phoneObj.type || 'cell').toUpperCase();
            if (phone) {
                if (version === '4.0') {
                    lines.push(`TEL;TYPE=${type.toLowerCase()};VALUE=uri:tel:${phone.replace(/[\s\-\(\)\.]/g, '')}`);
                } else {
                    lines.push(`TEL;TYPE=${type}:${phone}`);
                }
            }
        }
    }

    /**
     * Add email addresses to vCard
     * @param {Object} data
     * @param {Array} lines
     * @param {string} version
     */
    static addVCardEmails(data, lines, version) {
        const emails = data.emails || [];

        // Handle single email field
        if (data.email) {
            if (version === '4.0') {
                lines.push(`EMAIL;TYPE=internet:${data.email}`);
            } else {
                lines.push(`EMAIL;TYPE=INTERNET:${data.email}`);
            }
        }

        if (data.work_email || data.workEmail) {
            const email = data.work_email || data.workEmail;
            if (version === '4.0') {
                lines.push(`EMAIL;TYPE=work:${email}`);
            } else {
                lines.push(`EMAIL;TYPE=WORK:${email}`);
            }
        }

        // Handle emails array
        for (const emailObj of emails) {
            const email = emailObj.email || emailObj.address || emailObj.value;
            const type = (emailObj.type || 'internet').toUpperCase();
            if (email) {
                if (version === '4.0') {
                    lines.push(`EMAIL;TYPE=${type.toLowerCase()}:${email}`);
                } else {
                    lines.push(`EMAIL;TYPE=${type}:${email}`);
                }
            }
        }
    }

    /**
     * Add address to vCard
     * @param {Object} data
     * @param {Array} lines
     * @param {string} version
     */
    static addVCardAddress(data, lines, version) {
        // Check for address object or individual fields
        const address = data.address || {};
        const street = address.street || data.street || data.address_line1 || '';
        const extendedAddress = address.extended || data.address_line2 || '';
        const city = address.city || data.city || '';
        const state = address.state || data.state || data.region || '';
        const postalCode = address.postalCode || address.zip || data.postalCode || data.zip || data.postal_code || '';
        const country = address.country || data.country || '';
        const poBox = address.poBox || data.po_box || '';

        if (street || city || state || postalCode || country) {
            const type = address.type || data.address_type || 'home';
            // ADR format: PO Box;Extended;Street;City;State;Postal;Country
            const adrValue = [
                this.escapeVCardValue(poBox),
                this.escapeVCardValue(extendedAddress),
                this.escapeVCardValue(street),
                this.escapeVCardValue(city),
                this.escapeVCardValue(state),
                this.escapeVCardValue(postalCode),
                this.escapeVCardValue(country)
            ].join(';');

            if (version === '4.0') {
                lines.push(`ADR;TYPE=${type.toLowerCase()}:${adrValue}`);
            } else {
                lines.push(`ADR;TYPE=${type.toUpperCase()}:${adrValue}`);
            }
        }
    }

    /**
     * Add social profiles to vCard
     * @param {Object} data
     * @param {Array} lines
     */
    static addVCardSocialProfiles(data, lines) {
        const socialProfiles = {
            facebook: data.facebook,
            twitter: data.twitter,
            linkedin: data.linkedin,
            instagram: data.instagram,
            youtube: data.youtube,
            github: data.github,
            tiktok: data.tiktok,
        };

        for (const [network, url] of Object.entries(socialProfiles)) {
            if (url) {
                lines.push(`X-SOCIALPROFILE;TYPE=${network}:${url}`);
            }
        }
    }

    /**
     * Escape special characters in vCard values
     * @param {string} value
     * @returns {string}
     */
    static escapeVCardValue(value) {
        if (!value) return '';
        // Escape backslash, semicolon, comma, and newlines
        return value
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    /**
     * Encode geographic location
     * @param {Object} data - Location data
     * @returns {string}
     */
    static encodeLocation(data) {
        const lat = data.latitude || data.lat || 0;
        const lng = data.longitude || data.lng || data.lon || 0;
        const query = data.query || data.address || data.name || '';

        // If we have a query/address, use Google Maps format
        if (query && !lat && !lng) {
            return `https://maps.google.com/maps?q=${encodeURIComponent(query)}`;
        }

        // Standard geo URI format
        if (query) {
            return `geo:${lat},${lng}?q=${encodeURIComponent(query)}`;
        }

        return `geo:${lat},${lng}`;
    }

    /**
     * Encode calendar event (iCal)
     * @param {Object} data - Event data
     * @returns {string}
     */
    static encodeEvent(data) {
        const lines = [];

        lines.push('BEGIN:VCALENDAR');
        lines.push('VERSION:2.0');
        lines.push('PRODID:-//QR Support Backend//EN');
        lines.push('BEGIN:VEVENT');

        // Generate unique ID
        const uid = data.uid || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@qr-support`;
        lines.push(`UID:${uid}`);

        // Summary/Title (required)
        const summary = data.summary || data.title || data.name || 'Event';
        lines.push(`SUMMARY:${this.escapeICalValue(summary)}`);

        // Description
        if (data.description || data.details) {
            lines.push(`DESCRIPTION:${this.escapeICalValue(data.description || data.details)}`);
        }

        // Location
        if (data.location || data.venue) {
            lines.push(`LOCATION:${this.escapeICalValue(data.location || data.venue)}`);
        }

        // Start date/time
        const dtStart = this.formatICalDate(data.start || data.startDate || data.start_date || new Date());
        lines.push(`DTSTART:${dtStart}`);

        // End date/time
        if (data.end || data.endDate || data.end_date) {
            const dtEnd = this.formatICalDate(data.end || data.endDate || data.end_date);
            lines.push(`DTEND:${dtEnd}`);
        } else if (data.duration) {
            // Duration in minutes
            lines.push(`DURATION:PT${data.duration}M`);
        }

        // All day event
        if (data.allDay || data.all_day) {
            // Reformat as date only
            lines[lines.findIndex(l => l.startsWith('DTSTART'))] = `DTSTART;VALUE=DATE:${dtStart.substring(0, 8)}`;
        }

        // Organizer
        if (data.organizer || data.organizerEmail) {
            const email = data.organizerEmail || data.organizer;
            const name = data.organizerName || '';
            if (name) {
                lines.push(`ORGANIZER;CN=${this.escapeICalValue(name)}:mailto:${email}`);
            } else {
                lines.push(`ORGANIZER:mailto:${email}`);
            }
        }

        // URL
        if (data.url) {
            lines.push(`URL:${data.url}`);
        }

        // Reminder/Alarm
        if (data.reminder || data.alarm) {
            const minutes = data.reminder || data.alarm || 15;
            lines.push('BEGIN:VALARM');
            lines.push('ACTION:DISPLAY');
            lines.push(`TRIGGER:-PT${minutes}M`);
            lines.push('DESCRIPTION:Reminder');
            lines.push('END:VALARM');
        }

        // Timestamp
        lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);

        lines.push('END:VEVENT');
        lines.push('END:VCALENDAR');

        return lines.join('\r\n');
    }

    /**
     * Format date for iCal
     * @param {Date|string} date
     * @returns {string}
     */
    static formatICalDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) {
            return this.formatICalDate(new Date());
        }

        const pad = (n) => String(n).padStart(2, '0');

        const year = d.getUTCFullYear();
        const month = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        const hours = pad(d.getUTCHours());
        const minutes = pad(d.getUTCMinutes());
        const seconds = pad(d.getUTCSeconds());

        return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
    }

    /**
     * Escape special characters for iCal
     * @param {string} value
     * @returns {string}
     */
    static escapeICalValue(value) {
        if (!value) return '';
        return value
            .replace(/\\/g, '\\\\')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,')
            .replace(/\n/g, '\\n');
    }

    /**
     * Encode WhatsApp link
     * @param {Object} data - WhatsApp data
     * @returns {string}
     */
    static encodeWhatsApp(data) {
        const phone = (data.phone || data.number || '').replace(/[\s\-\(\)\.]/g, '');
        const message = data.message || data.text || '';

        // Use wa.me format
        let url = `https://wa.me/${phone}`;

        if (message) {
            url += `?text=${encodeURIComponent(message)}`;
        }

        return url;
    }

    /**
     * Encode social media link
     * @param {Object} data - Social media data
     * @returns {string}
     */
    static encodeSocial(data) {
        const platform = (data.platform || data.network || 'generic').toLowerCase();
        const username = data.username || data.handle || data.user || '';
        const url = data.url || '';

        // If a direct URL is provided, use it
        if (url) {
            return this.ensureValidUrl(url);
        }

        // Build URL based on platform
        const platformUrls = {
            facebook: `https://facebook.com/${username}`,
            twitter: `https://twitter.com/${username}`,
            x: `https://x.com/${username}`,
            instagram: `https://instagram.com/${username}`,
            linkedin: `https://linkedin.com/in/${username}`,
            youtube: `https://youtube.com/@${username}`,
            tiktok: `https://tiktok.com/@${username}`,
            snapchat: `https://snapchat.com/add/${username}`,
            pinterest: `https://pinterest.com/${username}`,
            reddit: `https://reddit.com/user/${username}`,
            github: `https://github.com/${username}`,
            telegram: `https://t.me/${username}`,
            discord: `https://discord.gg/${username}`,
            twitch: `https://twitch.tv/${username}`,
            spotify: `https://open.spotify.com/user/${username}`,
        };

        return platformUrls[platform] || `https://${platform}.com/${username}`;
    }

    /**
     * Encode cryptocurrency address
     * @param {Object} data - Crypto data
     * @returns {string}
     */
    static encodeCrypto(data) {
        const currency = (data.currency || data.coin || data.crypto || 'bitcoin').toLowerCase();
        const address = data.address || data.wallet || '';
        const amount = data.amount || '';
        const label = data.label || data.name || '';
        const message = data.message || data.note || '';

        // Map common currency names to URI schemes
        const currencySchemes = {
            bitcoin: 'bitcoin',
            btc: 'bitcoin',
            ethereum: 'ethereum',
            eth: 'ethereum',
            litecoin: 'litecoin',
            ltc: 'litecoin',
            dogecoin: 'dogecoin',
            doge: 'dogecoin',
            dash: 'dash',
            monero: 'monero',
            xmr: 'monero',
            zcash: 'zcash',
            zec: 'zcash',
            bitcoincash: 'bitcoincash',
            bch: 'bitcoincash',
        };

        const scheme = currencySchemes[currency] || currency;
        let uri = `${scheme}:${address}`;

        const params = [];
        if (amount) params.push(`amount=${amount}`);
        if (label) params.push(`label=${encodeURIComponent(label)}`);
        if (message) params.push(`message=${encodeURIComponent(message)}`);

        if (params.length > 0) {
            uri += `?${params.join('&')}`;
        }

        return uri;
    }

    /**
     * Encode UPI (Unified Payments Interface - India)
     * @param {Object} data - UPI data
     * @returns {string}
     */
    static encodeUpi(data) {
        const vpa = data.vpa || data.upiId || data.upi_id || '';
        const payeeName = data.payeeName || data.name || data.pn || '';
        const amount = data.amount || data.am || '';
        const transactionNote = data.note || data.tn || '';
        const transactionId = data.transactionId || data.tr || '';
        const currencyCode = data.currency || data.cu || 'INR';
        const merchantCode = data.merchantCode || data.mc || '';

        let uri = `upi://pay?pa=${encodeURIComponent(vpa)}`;

        if (payeeName) uri += `&pn=${encodeURIComponent(payeeName)}`;
        if (amount) uri += `&am=${amount}`;
        if (transactionNote) uri += `&tn=${encodeURIComponent(transactionNote)}`;
        if (transactionId) uri += `&tr=${encodeURIComponent(transactionId)}`;
        if (currencyCode) uri += `&cu=${currencyCode}`;
        if (merchantCode) uri += `&mc=${encodeURIComponent(merchantCode)}`;

        return uri;
    }

    /**
     * Encode PIX (Brazilian instant payment)
     * @param {Object} data - PIX data
     * @returns {string}
     */
    static encodePix(data) {
        // PIX uses EMV QR Code format
        // This is a simplified version - full PIX requires EMVCo spec
        const key = data.key || data.pixKey || data.chave || '';
        const name = data.name || data.merchantName || '';
        const city = data.city || data.merchantCity || '';
        const amount = data.amount || data.valor || '';
        const description = data.description || data.descricao || '';

        // For simplicity, generate a PIX copy-paste string
        // Full EMV implementation would require additional complexity
        if (data.emv || data.qrCode) {
            // If raw EMV code is provided, use it directly
            return data.emv || data.qrCode;
        }

        // Generate a simple PIX URL
        let pixUrl = `https://pix.com.br/pay?key=${encodeURIComponent(key)}`;

        if (name) pixUrl += `&name=${encodeURIComponent(name)}`;
        if (city) pixUrl += `&city=${encodeURIComponent(city)}`;
        if (amount) pixUrl += `&amount=${amount}`;
        if (description) pixUrl += `&desc=${encodeURIComponent(description)}`;

        return pixUrl;
    }

    /**
     * Get list of supported types
     * @returns {string[]}
     */
    static getSupportedTypes() {
        return Object.values(this.TYPES);
    }

    /**
     * Check if a type is supported
     * @param {string} type
     * @returns {boolean}
     */
    static isTypeSupported(type) {
        return this.getSupportedTypes().includes(type.toLowerCase());
    }
}

module.exports = QRDataEncoder;
