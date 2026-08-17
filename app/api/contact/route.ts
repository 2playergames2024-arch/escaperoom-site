import { Resend } from "resend";
import { Redis } from "@upstash/redis";

const resend = new Resend(process.env.RESEND_API_KEY);
const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey = `rate-limit:contact:${ip}`;

    const attempts = await redis.incr(rateLimitKey);

    if (attempts === 1) {
      await redis.expire(rateLimitKey, 600);
    }

    if (attempts > 5) {
      return Response.json(
        {
          error:
            "Too many contact form submissions. Please wait a few minutes and try again.",
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const message = String(formData.get("message") || "").trim();

    // Hidden honeypot field. Real customers should never fill this in.
    const website = String(formData.get("website") || "").trim();

    if (website) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/contact?sent=true",
        },
      });
    }

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return Response.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return Response.json(
        { error: "Name is too long." },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return Response.json(
        { error: "Email address is too long." },
        { status: 400 }
      );
    }

    if (phone.length > 40) {
      return Response.json(
        { error: "Phone number is too long." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return Response.json(
        { error: "Message is too long." },
        { status: 400 }
      );
    }

    const { error } = await resend.emails.send({
      from: "Escape Room Mystery <info@escaperoommystery.com>",
      to: ["info@escaperoommystery.com"],
      replyTo: email,
      subject: `Website Contact Form - ${name}`,
      text: `
Name: ${name}
Email: ${email}
Phone: ${phone}

Message:
${message}
      `,
    });

    if (error) {
      console.error(error);

      return Response.json(
        { error: "Email failed to send." },
        { status: 500 }
      );
    }

    return new Response(null, {
      status: 303,
      headers: {
        Location: "/contact?sent=true",
      },
    });
  } catch (error) {
    console.error("Contact form error:", error);

    return Response.json(
      { error: "Unable to send message. Please try again." },
      { status: 500 }
    );
  }
}