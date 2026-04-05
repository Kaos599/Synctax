import type { AdapterId } from "../src/adapters/index.js";

const validAdapterId: AdapterId = "claude";

// @ts-expect-error AdapterId should reject arbitrary strings.
const invalidAdapterId: AdapterId = "mockclient";

void validAdapterId;
void invalidAdapterId;
