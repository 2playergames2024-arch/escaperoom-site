import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const formData = await request.formData();

  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "");
  const phone = String(formData.get("phone") || "");
  const message = String(formData.get("message") || "");

  if (!name || !email || !message) {
    return Response.json(
      { error: "Name, email, and message are required." },
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
    return Response.json({ error: "Email failed to send." }, { status: 500 });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/contact?sent=true",
    },
  });
}