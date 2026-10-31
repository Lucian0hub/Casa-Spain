# House website

Plain HTML, CSS and JavaScript. No builder, no framework, no monthly fees.

## Change the text
- House name, email, number of rooms: `config.js`
- All texts in Dutch, English and Spanish: `lang.js` (replace the [bracketed] text)

## Change the photos
1. Put the photo files in `photos/` (JPG, ideally about 2000 px wide).
2. List them in `photos/photos.json`. The first one is the big header photo.
   `section` is either `house` or `surroundings`. Captions are per language.

## Calendar
- Airbnb and Booking.com are read every 3 hours by `.github/workflows/sync-calendar.yml`.
- Put their iCal export links in the GitHub secret `ICAL_URLS` (one per line).
- Add bookings made by email to `data/manual-bookings.json`. Departure day is the `end` date.
- Give `https://<your-site>/data/calendar.ics` to Airbnb and Booking.com ("import calendar")
  so they also block your email bookings.
