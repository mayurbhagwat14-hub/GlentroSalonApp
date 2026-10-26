const env = require('../config/env');

/**
 * Format phone number for SMS gateway
 * Strips non-digits and leading +91 or 0
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
};

/**
 * Send OTP SMS using SMS India Hub Gateway
 * DLT Message format:
 * "Welcome to the glentro powered by Appzeto.Your OTP for registration is {otp}.BGADEC"
 */
const sendOtpSMS = async (phone, otp) => {
  const cleanedPhone = cleanPhoneNumber(phone);
  if (!cleanedPhone || cleanedPhone.length !== 10) {
    throw new Error('Please enter a valid 10-digit Indian mobile number');
  }

  const messageText = `Welcome to the glentro powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;

  const username = env.SMS_INDIA_HUB_USERNAME || 'GLENTRO';
  const apiKey = env.SMS_INDIA_HUB_API_KEY;
  const senderId = env.SMS_INDIA_HUB_SENDER_ID || 'BGADEC';
  const templateId = env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;

  if (!apiKey) {
    console.warn('[SMS] SMS_INDIA_HUB_API_KEY is not configured in .env. Mock OTP:', otp);
    return { success: true, mocked: true, otp };
  }

  try {
    const mobileWithCountryCode = `91${cleanedPhone}`;

    const payload = {
      Account: {
        APIKey: apiKey,
        User: username,
        SenderId: senderId,
        Channel: 'Trans',
        DCS: '0',
        FlashSms: '0',
        Route: 1,
        TemplateId: templateId || undefined,
      },
      Messages: [
        {
          Number: mobileWithCountryCode,
          Text: messageText,
        },
      ],
    };

    console.log(`[SMS] Sending OTP to ${mobileWithCountryCode} via REST API (Channel: Trans, Route: 1)`);
    const response = await fetch('https://cloud.smsindiahub.in/api/mt/SendSMS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseJson = await response.json();
    console.log(`[SMS] SMS Gateway response:`, responseJson);

    if (responseJson.ErrorCode !== '000') {
      console.error('[SMS] Gateway reported error:', responseJson.ErrorMessage);
      throw new Error(`SMS gateway error: ${responseJson.ErrorMessage || 'Submission failed'}`);
    }

    return {
      success: true,
      data: responseJson,
    };
  } catch (error) {
    console.error('[SMS] Error sending SMS via SMS India Hub:', error.message);
    throw new Error('Failed to send SMS OTP. Please try again later.');
  }
};

module.exports = {
  cleanPhoneNumber,
  sendOtpSMS,
};
