// tests/bookingRef.test.js
//
// booking_ref is a capability, not just a display string: whoever holds one can
// read that booking's payment status from the public API. So the properties
// that matter are unguessability and uniqueness, not merely formatting.

const {
  generateBookingRef,
  generateUniqueBookingRef,
  isValidBookingRef,
} = require('../helpers/bookingRef');

describe('generateBookingRef', () => {
  test('matches the documented shape', () => {
    expect(generateBookingRef()).toMatch(/^ZM-[A-HJ-NP-Z2-9]{6}$/);
  });

  test('omits characters guests misread over the phone', () => {
    // No I, O, 0 or 1 — staff read these aloud to guests.
    const joined = Array.from({ length: 400 }, generateBookingRef).join('');
    expect(joined).not.toMatch(/[IO01]/);
  });

  test('collisions are rare across a realistic volume', () => {
    const refs = new Set(Array.from({ length: 20000 }, generateBookingRef));
    // ~1.07e9 space; a handful of birthday collisions at 20k is expected, but
    // anything approaching a systematic clash means the RNG is broken.
    expect(refs.size).toBeGreaterThan(19990);
  });

  test('is not sequential or time-ordered', () => {
    // ObjectIds leak creation order; these must not, or one reference would
    // hint at its neighbours.
    const a = generateBookingRef();
    const b = generateBookingRef();
    expect(a).not.toBe(b);
    expect(a.slice(0, 5)).not.toBe(b.slice(0, 5));
  });
});

describe('isValidBookingRef', () => {
  test('accepts generated references', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(isValidBookingRef(generateBookingRef())).toBe(true);
    }
  });

  test.each([
    ['ZM-ABC12', 'too short'],
    ['ZM-ABC1234', 'too long'],
    ['XX-ABCDEF', 'wrong prefix'],
    ['ZM-ABCDEI', 'excluded letter I'],
    ['ZM-ABCDE0', 'excluded digit 0'],
    ['ZM-abcdef', 'lowercase'],
    ['ZMABCDEF', 'missing separator'],
    ['', 'empty'],
    [null, 'null'],
    [undefined, 'undefined'],
    [12345, 'not a string'],
  ])('rejects %p (%s)', (input) => {
    expect(isValidBookingRef(input)).toBe(false);
  });
});

describe('generateUniqueBookingRef', () => {
  test('returns a reference not already present', async () => {
    const fakeModel = { exists: jest.fn().mockResolvedValue(null) };
    const ref = await generateUniqueBookingRef(fakeModel);
    expect(isValidBookingRef(ref)).toBe(true);
    expect(fakeModel.exists).toHaveBeenCalledTimes(1);
  });

  test('retries when the first candidates already exist', async () => {
    const fakeModel = {
      exists: jest.fn()
        .mockResolvedValueOnce({ _id: 'x' })
        .mockResolvedValueOnce({ _id: 'y' })
        .mockResolvedValue(null),
    };
    const ref = await generateUniqueBookingRef(fakeModel);
    expect(isValidBookingRef(ref)).toBe(true);
    expect(fakeModel.exists).toHaveBeenCalledTimes(3);
  });

  test('gives up loudly rather than returning a duplicate', async () => {
    // Silently returning a colliding ref would let one guest read another's
    // booking, so exhaustion must be an error.
    const fakeModel = { exists: jest.fn().mockResolvedValue({ _id: 'always' }) };
    await expect(generateUniqueBookingRef(fakeModel, 3))
      .rejects.toThrow(/Could not generate a unique booking_ref/);
    expect(fakeModel.exists).toHaveBeenCalledTimes(3);
  });
});
