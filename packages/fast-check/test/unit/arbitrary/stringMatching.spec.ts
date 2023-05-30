import * as fc from 'fast-check';
import { stringMatching } from '../../../src/arbitrary/stringMatching';

import {
  assertProduceCorrectValues,
  assertProduceSameValueGivenSameSeed,
} from './__test-helpers__/ArbitraryAssertions';

describe('stringMatching (integration)', () => {
  const extraParameters: fc.Arbitrary<Extra> = fc.oneof(hardcodedRegex(), regexBasedOnChunks());

  const stringMatchingBuilder = (extra: Extra) => stringMatching(extra.regex);

  const isCorrect = (value: string, extra: Extra) => extra.regex.test(value);

  it('should produce the same values given the same seed', () => {
    assertProduceSameValueGivenSameSeed(stringMatchingBuilder, { extraParameters });
  });

  it('should only produce correct values', () => {
    assertProduceCorrectValues(stringMatchingBuilder, isCorrect, { extraParameters });
  });
});

// Helpers

type Extra = { regex: RegExp };

function hardcodedRegex(): fc.Arbitrary<Extra> {
  return fc.constantFrom(
    // IPv4
    { regex: /^\d+\.\d+\.\d+\.\d+$/ },
    // IPv4
    { regex: /^([0-9]{1,3}\.){3}\.([0-9]{1,3})$/ },
    // IPv4
    {
      regex:
        /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    },
    // IPv6
    {
      regex:
        /^((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|(([0-9A-Fa-f]{1,4}:){0,5}:((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|(::([0-9A-Fa-f]{1,4}:){0,5}((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|([0-9A-Fa-f]{1,4}::([0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){1,7}:))$/,
    },
    // E-mail address based on RFC-1123
    {
      regex:
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    },
    // E-mail address based on RFC-5322
    {
      regex:
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    }
  );
}

function regexBasedOnChunks(): fc.Arbitrary<Extra> {
  const regexQuantifiableChunks = [
    '[s-z]', // any character in range s to z
    '[ace]', // any character from ace
    '[^s-z]', // any character not in range s to z
    '[^ace]', // any character not from ace
    '.', // 'any' character
    ...['w', 'd', 's' /*'b'*/].map((v) => `\\${v}`), // lower case meta characters
    ...['w', 'd', 's' /*'b'*/].map((v) => `\\${v.toUpperCase()}`), // upper case meta characters
    ...' \t\r\n\v\f', // spaces
    ...'\r\n\x1E\x15', // new lines and terminators
    ...'0123456789ABCDEFabcdef-', // some letters, digits... (just some hardcoded characters)
  ];
  return fc
    .array(
      fc.record({
        startAssertion: fc.boolean(),
        endAssertion: fc.boolean(),
        chunks: fc.array(
          fc.record(
            {
              matcher: fc.constantFrom(...regexQuantifiableChunks),
              quantifier: fc.oneof(
                fc.constantFrom('?', '*', '+'),
                fc.nat({ max: 5 }),
                fc.tuple(fc.nat({ max: 5 }), fc.option(fc.nat({ max: 5 })))
              ),
            },
            { requiredKeys: ['matcher'] }
          ),
          { minLength: 1 }
        ),
      }),
      { minLength: 1, size: '-1' }
    )
    .map((disjunctions) => {
      return {
        regex: new RegExp(
          disjunctions
            .map(({ startAssertion, endAssertion, chunks }) => {
              const start = startAssertion ? '^' : '';
              const end = endAssertion ? '$' : '';
              const content = chunks
                .map((chunk) => {
                  const quantifier = chunk.quantifier;
                  const quantifierString =
                    quantifier === undefined
                      ? ''
                      : typeof quantifier === 'string'
                      ? quantifier
                      : typeof quantifier === 'number'
                      ? `{${quantifier}}`
                      : typeof quantifier[1] === 'number'
                      ? `{${Math.min(...(quantifier as [number, number]))},${Math.max(
                          ...(quantifier as [number, number])
                        )}}`
                      : `{${quantifier[0]},}`;
                  return chunk.matcher + quantifierString;
                })
                .join('');
              return start + content + end;
            })
            .join('|')
        ),
      };
    });
}
