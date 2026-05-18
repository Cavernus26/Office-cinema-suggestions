# Security Specification - Movie Recommendation App

## Data Invariants
1. **Recommendations**: Must have a valid `authorId`. Only the author can update metadata (title, description, etc.).
2. **Ratings**:
   - Must be in `recommendations/{recId}/ratings/{userId}`.
   - `userId` must match the document ID and `request.auth.uid`.
   - Rating value must be an integer between 1 and 5.
   - A user **cannot** rate their own recommendation.
3. **Aggregates**:
   - `averageRating` and `ratingCount` on the recommendation document must reflect the state of the `ratings` subcollection.
   - Profile-level aggregates (on the `users` document) should match the sum of all ratings for that user's recommendations.

## The "Dirty Dozen" Payloads (Denial Tests)

1. **Self-Rating**: User A tries to create a rating on their own recommendation.
2. **Identity Spoofing**: User A tries to create a rating with document ID of User B.
3. **Invalid Rating Value**: User A tries to submit a rating of 6.
4. **Metadata Tampering (Non-Owner)**: User A tries to update the `title` of a recommendation they didn't create.
5. **Unauthorized Recommendation Creation**: Unsigned user tries to create a recommendation.
6. **Recommendation Deletion (Non-Owner)**: User A tries to delete User B's recommendation.
7. **Bypassing Aggregates**: User A tries to update `averageRating` on a recommendation without writing a rating in the same transaction (or writing it manually).
8. **Shadow Field Injection**: User A tries to add `isAdmin: true` to their user profile.
9. **Rating Update of others**: User A tries to update User B's rating doc.
10. **Orphaned Rating**: User A tries to rate a recommendation that doesn't exist (path variable hardening).
11. **Resource Poisoning**: User A tries to write a 1MB string into the `userName` field of a rating.
12. **Status Tampering**: User A tries to update the `authorId` of an existing recommendation to themselves.

## Test Runner (Logic Check)
The rules will be audited against these payloads.
