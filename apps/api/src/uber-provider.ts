import {
  bookRideResultSchema,
  computeArrivalTarget,
  findRideOptionsInputSchema,
  findRideOptionsResultSchema,
  getMariaAppointment,
  type BookRideResult,
  type FindRideOptionsInput,
  type FindRideOptionsResult,
} from "@kasama/shared";

export type UberProvider = {
  findOptions: (input: FindRideOptionsInput) => FindRideOptionsResult;
  book: (optionId: string) => BookRideResult;
};

export type ControlledUberProviderOptions = {
  failNextVerify?: boolean;
};

const DEMO_OPTIONS = [
  {
    optionId: "uberx_1",
    product: "UberX" as const,
    estimate: "$18.00",
    etaMinutes: 8,
    accessible: false,
  },
  {
    optionId: "uber_wav_1",
    product: "WAV" as const,
    estimate: "$24.50",
    etaMinutes: 12,
    accessible: true,
  },
] as const;

type Quote = {
  optionId: string;
  product: "UberX" | "WAV";
  estimate: string;
  accessible: boolean;
  pickup: string;
  destination: string;
  arriveBy: string;
};

type StoredBooking = {
  confirmationId: string;
  optionId: string;
};

export function createControlledUberProvider(
  options: ControlledUberProviderOptions = {},
): UberProvider {
  const quotes = new Map<string, Quote>();
  const bookings = new Map<string, StoredBooking>();
  let nextSerial = 1;
  let failNextVerify = Boolean(options.failNextVerify);

  const appointment = getMariaAppointment();
  const arriveBy = computeArrivalTarget(appointment);
  for (const option of DEMO_OPTIONS) {
    quotes.set(option.optionId, {
      optionId: option.optionId,
      product: option.product,
      estimate: option.estimate,
      accessible: option.accessible,
      pickup: appointment.pickup,
      destination: appointment.destination,
      arriveBy,
    });
  }

  return {
    findOptions(input) {
      const parsed = findRideOptionsInputSchema.parse(input);
      for (const option of DEMO_OPTIONS) {
        quotes.set(option.optionId, {
          optionId: option.optionId,
          product: option.product,
          estimate: option.estimate,
          accessible: option.accessible,
          pickup: parsed.pickup,
          destination: parsed.destination,
          arriveBy: parsed.arriveBy,
        });
      }
      return findRideOptionsResultSchema.parse({
        success: true,
        summary: `Two Uber options from ${parsed.pickup} to ${parsed.destination}: UberX about $18.00, WAV about $24.50.`,
        options: DEMO_OPTIONS.map((option) => ({
          optionId: option.optionId,
          provider: "uber" as const,
          product: option.product,
          estimate: option.estimate,
          etaMinutes: option.etaMinutes,
          accessible: option.accessible,
        })),
      });
    },
    book(optionId) {
      const quote = quotes.get(optionId);
      if (!quote) {
        return bookRideResultSchema.parse({
          success: false,
          summary: "That Uber option is no longer available. Nothing was booked.",
        });
      }
      const productToken = quote.product === "WAV" ? "WAV" : "UBERX";
      const confirmationId = `UBER-${productToken}-${String(nextSerial).padStart(4, "0")}`;
      nextSerial += 1;
      const record = { confirmationId, optionId };
      bookings.set(confirmationId, record);
      if (failNextVerify) {
        failNextVerify = false;
        bookings.delete(confirmationId);
      }
      const proven = bookings.get(confirmationId);
      if (!proven) {
        return bookRideResultSchema.parse({
          success: false,
          summary: "I couldn't confirm that Uber booking. Nothing was charged.",
        });
      }
      return bookRideResultSchema.parse({
        success: true,
        confirmationId,
        summary: `Uber ${quote.product} booked for ${quote.estimate}. Confirmation ${confirmationId}.`,
        booking: { provider: "uber", optionId, status: "booked" },
      });
    },
  };
}

let singleton = createControlledUberProvider();

export function getUberProvider(): UberProvider {
  return singleton;
}

export function resetControlledUberProvider(
  options: ControlledUberProviderOptions = {},
): UberProvider {
  singleton = createControlledUberProvider(options);
  return singleton;
}
