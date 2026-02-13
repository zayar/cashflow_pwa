import { gql } from '@apollo/client';

export const GET_BUSINESS_PROFILE = gql`
  query GetBusinessProfileForPwa {
    getBusiness {
      id
      logoUrl
      name
      contactName
      email
      phone
      mobile
      website
      about
      address
      country
      city
      state {
        id
        code
        stateNameEn
      }
      township {
        id
        code
        stateCode
        townshipNameEn
      }
      baseCurrency {
        id
        name
        symbol
        decimalPlaces
      }
      fiscalYear
      reportBasis
      timezone
      companyId
      taxId
      isTaxInclusive
      isTaxExclusive
      primaryBranch {
        id
        name
      }
    }
  }
`;

export const UPDATE_BUSINESS_PROFILE = gql`
  mutation UpdateBusinessProfileForPwa($input: NewBusiness!) {
    updateBusiness(input: $input) {
      id
      logoUrl
      name
      contactName
      email
      phone
      mobile
      website
      about
      address
      country
      city
      state {
        id
        code
        stateNameEn
      }
      township {
        id
        code
        stateCode
        townshipNameEn
      }
      baseCurrency {
        id
        name
        symbol
        decimalPlaces
      }
      fiscalYear
      reportBasis
      timezone
      companyId
      taxId
      isTaxInclusive
      isTaxExclusive
      primaryBranch {
        id
        name
      }
    }
  }
`;

function safeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function maybeText(value) {
  if (value == null) return value;
  return String(value).trim();
}

function toId(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.trunc(numeric);
}

export function normalizeBusinessProfile(rawProfile) {
  if (!rawProfile) return null;

  const name = safeText(rawProfile.name);
  const phone = safeText(rawProfile.phone);
  const city = safeText(rawProfile.city);
  const address = safeText(rawProfile.address);
  const logoUrl = safeText(rawProfile.logoUrl);

  return {
    ...rawProfile,
    name,
    businessName: name,
    phone,
    city,
    address,
    logoUrl,
    addressLine: [address, city].filter(Boolean).join(', ')
  };
}

export function isProfileComplete(profile) {
  const normalized = normalizeBusinessProfile(profile);
  if (!normalized) return false;
  return Boolean(normalized.businessName && normalized.phone);
}

function buildBusinessUpdateInput(currentProfile, updates = {}) {
  const current = normalizeBusinessProfile(currentProfile) || {};
  const nextName = safeText(updates.businessName ?? updates.name ?? current.businessName ?? current.name);
  const nextPhone = safeText(updates.phone ?? current.phone);
  const nextCity = safeText(updates.city ?? current.city);
  const nextAddress = safeText(updates.address ?? current.address);
  const nextLogoUrl = safeText(updates.logoUrl ?? updates.logo_url ?? current.logoUrl);

  return {
    name: nextName,
    country: maybeText(current.country),
    stateId: toId(updates.stateId ?? current.state?.id),
    townshipId: toId(updates.townshipId ?? current.township?.id),
    city: nextCity,
    address: nextAddress,
    email: maybeText(current.email),
    phone: nextPhone,
    mobile: maybeText(current.mobile),
    baseCurrencyId: toId(updates.baseCurrencyId ?? current.baseCurrency?.id),
    fiscalYear: maybeText(current.fiscalYear),
    reportBasis: maybeText(current.reportBasis),
    companyId: maybeText(current.companyId),
    taxId: maybeText(current.taxId),
    logo_url: nextLogoUrl
  };
}

export async function fetchBusinessProfile(client, options = {}) {
  const { fetchPolicy = 'cache-first' } = options;
  const result = await client.query({
    query: GET_BUSINESS_PROFILE,
    fetchPolicy
  });
  return normalizeBusinessProfile(result?.data?.getBusiness);
}

export async function updateBusinessProfile(client, { currentProfile, updates }) {
  const sourceProfile =
    normalizeBusinessProfile(currentProfile) ||
    (await fetchBusinessProfile(client, { fetchPolicy: 'cache-first' }));

  const input = buildBusinessUpdateInput(sourceProfile, updates);

  const result = await client.mutate({
    mutation: UPDATE_BUSINESS_PROFILE,
    variables: { input }
  });

  const next = normalizeBusinessProfile(result?.data?.updateBusiness);

  if (next) return next;

  return normalizeBusinessProfile({ ...sourceProfile, ...updates, name: updates?.businessName ?? updates?.name ?? sourceProfile?.name });
}
