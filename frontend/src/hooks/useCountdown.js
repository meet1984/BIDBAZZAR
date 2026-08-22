import { useEffect, useState } from "react";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const ENDED_COUNTDOWN = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  isEnded: true,
  isFinalMinute: false,
  formattedTime: "Ended",
};

export function useCountdown(targetDateStr, options = {}) {
  const interval = options.interval || SECOND_MS;
  const hideSeconds = options.hideSeconds || false;

  const [timeLeft, setTimeLeft] = useState(() =>
    calculateTimeLeft(targetDateStr, hideSeconds),
  );

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(targetDateStr, hideSeconds));
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(targetDateStr, hideSeconds);
      setTimeLeft(remaining);
      if (remaining.isEnded) {
        clearInterval(timer);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [targetDateStr, interval, hideSeconds]);

  return timeLeft;
}

export function calculateTimeLeft(targetDateStr, hideSeconds = false) {
  if (!targetDateStr) return ENDED_COUNTDOWN;

  const targetTime = new Date(targetDateStr).getTime();
  const difference = targetTime - Date.now();

  if (!Number.isFinite(targetTime) || difference <= 0) return ENDED_COUNTDOWN;

  const days = Math.floor(difference / DAY_MS);
  const hours = Math.floor((difference / HOUR_MS) % 24);
  const minutes = Math.floor((difference / MINUTE_MS) % 60);
  const seconds = Math.floor((difference / SECOND_MS) % 60);

  const pad = (number) => String(number).padStart(2, "0");

  const formattedTime =
    days > 0
      ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
      : hideSeconds
        ? `${pad(hours)}h ${pad(minutes)}m`
        : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

  return {
    days,
    hours,
    minutes,
    seconds,
    isEnded: false,
    isFinalMinute: difference <= 60000,
    formattedTime,
  };
}

export function useAuctionTiming(startTimeStr, endTimeStr, statusHint) {
  const [timing, setTiming] = useState(() =>
    calculateAuctionTiming(startTimeStr, endTimeStr, statusHint),
  );

  useEffect(() => {
    setTiming(calculateAuctionTiming(startTimeStr, endTimeStr, statusHint));
    const timer = setInterval(() => {
      const current = calculateAuctionTiming(startTimeStr, endTimeStr, statusHint);
      setTiming(current);
      if (current.isEnded) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTimeStr, endTimeStr, statusHint]);

  return timing;
}

export function calculateAuctionTiming(startTimeStr, endTimeStr, statusHint) {
  const now = Date.now();
  const startTime = startTimeStr ? new Date(startTimeStr).getTime() : 0;
  const endTime = endTimeStr ? new Date(endTimeStr).getTime() : 0;

  if (statusHint === "closed" || (endTime > 0 && now >= endTime)) {
    return {
      phase: "closed",
      isUpcoming: false,
      isLive: false,
      isEndingSoon: false,
      isEnded: true,
      canBid: false,
      statusLabel: "Closed",
      countdownLabel: "Auction Closed",
      formattedTime: "Ended",
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  // Upcoming / Opening Soon
  if (startTime > 0 && now < startTime) {
    const diff = startTime - now;
    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff / HOUR_MS) % 24);
    const minutes = Math.floor((diff / MINUTE_MS) % 60);
    const seconds = Math.floor((diff / SECOND_MS) % 60);
    const pad = (n) => String(n).padStart(2, "0");

    const formattedTime =
      days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
        : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

    return {
      phase: "upcoming",
      isUpcoming: true,
      isLive: false,
      isEndingSoon: false,
      isEnded: false,
      canBid: false,
      statusLabel: "Opening Soon",
      countdownLabel: "Starts in",
      formattedTime,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  // Live or Ending Soon
  if (endTime > 0 && now < endTime) {
    const diff = endTime - now;
    const isEndingSoon = diff <= 3 * HOUR_MS || statusHint === "ending-soon";
    const days = Math.floor(diff / DAY_MS);
    const hours = Math.floor((diff / HOUR_MS) % 24);
    const minutes = Math.floor((diff / MINUTE_MS) % 60);
    const seconds = Math.floor((diff / SECOND_MS) % 60);
    const pad = (n) => String(n).padStart(2, "0");

    const formattedTime =
      days > 0
        ? `${days}d ${pad(hours)}h ${pad(minutes)}m`
        : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;

    return {
      phase: isEndingSoon ? "ending-soon" : "live",
      isUpcoming: false,
      isLive: true,
      isEndingSoon,
      isEnded: false,
      canBid: true,
      statusLabel: isEndingSoon ? "Ending Soon" : "Live Now",
      countdownLabel: "Ends in",
      formattedTime,
      days,
      hours,
      minutes,
      seconds,
    };
  }

  return {
    phase: "closed",
    isUpcoming: false,
    isLive: false,
    isEndingSoon: false,
    isEnded: true,
    canBid: false,
    statusLabel: "Closed",
    countdownLabel: "Auction Closed",
    formattedTime: "Ended",
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };
}

