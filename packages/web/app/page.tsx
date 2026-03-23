export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="px-6 py-24 md:py-32 max-w-4xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Meet <span className="text-blue-600">Sal</span>
        </h1>
        <p className="mt-6 text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">
          Your back-office teammate that answers the phone, books the jobs,
          dispatches your techs, and sends the invoices.
        </p>
        <p className="mt-4 text-lg text-gray-500">
          Built for plumbing contractors with 2-8 techs who are too busy
          running jobs to run the office.
        </p>
        <div className="mt-10">
          <a
            href="#how-it-works"
            className="inline-block bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-lg hover:bg-blue-700 transition"
          >
            See How Sal Works
          </a>
        </div>
      </section>

      {/* What Sal Does */}
      <section id="how-it-works" className="bg-gray-50 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">
            Sal handles the back office so you can stay on the job
          </h2>
          <div className="grid md:grid-cols-2 gap-10">
            <Card
              title="Answers Every Call"
              description="Sal picks up the phone 24/7, understands what the customer needs, and books the appointment — no hold music, no missed calls."
            />
            <Card
              title="Dispatches Your Techs"
              description="Sal builds the daily schedule, matches the right tech to every job based on skills and location, and sends morning briefings via text."
            />
            <Card
              title="Sends Confirmations & Updates"
              description="Customers get automated text messages for booking confirmations, tech en-route alerts, and appointment reminders."
            />
            <Card
              title="Handles Invoices & Payments"
              description="Sal generates invoices, sends payment links, and follows up on outstanding balances — so you get paid faster."
            />
            <Card
              title="Knows Your Customers"
              description="Sal remembers every customer's history, service address, and past jobs — so repeat callers feel known, not like a number."
            />
            <Card
              title="Alerts You When It Matters"
              description="Emergency calls, overdue invoices, unassigned jobs — Sal texts you the things you actually need to know about."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="space-y-8">
            <Step
              number="1"
              title="You sign up and tell Sal about your business"
              description="Your service area, your techs, your pricing, your hours. Takes about 10 minutes."
            />
            <Step
              number="2"
              title="Sal gets a phone number for your business"
              description="Forward your existing line or use Sal's number directly. Calls and texts go through Sal first."
            />
            <Step
              number="3"
              title="Sal goes to work"
              description="Calls get answered, jobs get booked, techs get dispatched, customers get updates. You stay focused on the work."
            />
          </div>
        </div>
      </section>

      {/* SMS Disclosure — important for Twilio compliance */}
      <section className="bg-gray-50 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Messaging & Communication
          </h2>
          <div className="text-gray-600 space-y-4">
            <p>
              Sal communicates with your customers and technicians via SMS text
              messages to provide appointment confirmations, technician dispatch
              notifications, en-route alerts, invoice delivery, payment
              reminders, and emergency escalation alerts.
            </p>
            <p>
              By using Sal, your customers consent to receive transactional text
              messages related to their service appointments. Message frequency
              varies based on service activity. Message and data rates may apply.
              Customers can reply STOP at any time to opt out of text messages.
            </p>
            <p>
              Sal also communicates with business owners and technicians via SMS
              for daily schedule briefings, job assignments, and urgent alerts.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">
          Ready to hire Sal?
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Early access for plumbing contractors. Get started today.
        </p>
        <div className="mt-8">
          <a
            href="mailto:contact@hiresal.com"
            className="inline-block bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-lg hover:bg-blue-700 transition"
          >
            Get Early Access
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-10 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Sal. All rights reserved.</p>
        <p className="mt-2">
          <a href="mailto:contact@hiresal.com" className="underline">
            matt@hiresal.com
          </a>
        </p>
      </footer>
    </main>
  );
}

function Card({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
}
