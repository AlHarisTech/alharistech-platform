declare const VALIDATED_BY_CRBL: unique symbol;

export type Validated<T> = T & { readonly [VALIDATED_BY_CRBL]: true };
