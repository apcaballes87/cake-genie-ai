import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addressContainsUnserviceableLocation,
    AddressForm,
    getGooglePlaceLocationDetails,
    MAP_SEARCH_INPUT_ATTRIBUTES,
    MapSearchInput,
} from './AddressForm';

type TestWindow = Window & { __googleMapsLoaded?: boolean; google?: unknown };
type MockGoogleMap = {
    getCenter: () => { lat: () => number; lng: () => number };
    panTo: () => void;
    setZoom: () => void;
};

vi.mock('@/hooks/useAddresses', () => ({
    useAddAddress: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateAddress: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/contexts/GoogleMapsLoaderContext', () => ({
    useGoogleMapsLoader: () => ({ isLoaded: (window as TestWindow).__googleMapsLoaded ?? true, loadError: undefined }),
    GoogleMapsLoaderProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@react-google-maps/api', async () => {
    const React = await import('react');
    const map = {
        getCenter: () => ({ lat: () => 10.3157, lng: () => 123.8854 }),
        panTo: () => undefined,
        setZoom: () => undefined,
    };

    return {
        GoogleMap: ({ onLoad }: { onLoad: (map: MockGoogleMap) => void }) => {
            React.useEffect(() => {
                onLoad(map);
            }, [onLoad]);
            return React.createElement('div', { 'data-testid': 'google-map-mock' });
        },
    };
});

let placeChanged: (() => void) | undefined;

beforeEach(() => {
    placeChanged = undefined;
    localStorage.clear();
    (window as TestWindow).__googleMapsLoaded = true;
    (window as TestWindow).google = {
        maps: {
            LatLng: class {},
            Circle: class {
                getBounds() { return null; }
            },
            places: {
                Autocomplete: class {
                    addListener(_event: string, callback: () => void) {
                        placeChanged = callback;
                    }
                    getPlace() {
                        return {
                            formatted_address: 'Unit 5, Cebu City, Cebu, Philippines',
                            geometry: { location: { lat: () => 10.3157, lng: () => 123.8854 } },
                            address_components: [{ long_name: 'Cebu City', types: ['locality', 'political'] }],
                        };
                    }
                },
            },
        },
    };
});

afterEach(() => {
    delete (window as TestWindow).google;
    delete (window as TestWindow).__googleMapsLoaded;
});

describe('unsupported delivery-address text', () => {
    it('matches Cavite, Metro Manila, and all Metro Manila cities', () => {
        const metroManilaCities = [
            'Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila',
            'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig',
            'Quezon City', 'San Juan', 'Taguig', 'Valenzuela',
        ];

        expect(addressContainsUnserviceableLocation('Bacoor, cavite')).toBe(true);
        expect(addressContainsUnserviceableLocation('Somewhere in METRO MANILA')).toBe(true);
        metroManilaCities.forEach((city) => {
            expect(addressContainsUnserviceableLocation(`Unit 2, ${city}`)).toBe(true);
            if (!city.endsWith('City')) {
                expect(addressContainsUnserviceableLocation(`Unit 2, ${city} City`)).toBe(true);
            }
        });
    });

    it('ignores accents and case while requiring locality boundaries', () => {
        expect(addressContainsUnserviceableLocation('las pinas')).toBe(true);
        expect(addressContainsUnserviceableLocation('PARANAQUE CITY')).toBe(true);
        expect(addressContainsUnserviceableLocation('Cavitex, Cebu City')).toBe(false);
        expect(addressContainsUnserviceableLocation('Unit 2, Cebu City, Cebu')).toBe(false);
    });
});

describe('Google Places delivery-location selection', () => {
    it('retains the exact formatted address, coordinates, and serviceable city', () => {
        const details = getGooglePlaceLocationDetails({
            formatted_address: 'Park Tower One, Samar Loop, Cebu City, Cebu, Philippines',
            geometry: {
                location: {
                    lat: () => 10.32123,
                    lng: () => 123.91456,
                },
            },
            address_components: [
                { long_name: 'Cebu City', types: ['locality', 'political'] },
            ],
        });

        expect(details).toEqual({
            latitude: 10.32123,
            longitude: 123.91456,
            street_address: 'Park Tower One, Samar Loop, Cebu City, Cebu, Philippines',
            city: 'Cebu City',
            isServiceable: true,
        });
    });

    it('requires both a formatted address and map coordinates from Google Places', () => {
        expect(getGooglePlaceLocationDetails({ formatted_address: 'Park Tower One' })).toBeNull();
        expect(getGooglePlaceLocationDetails({ geometry: { location: {} } })).toBeNull();
    });

    it('configures the map search as a non-autofill browser field', () => {
        render(createElement(MapSearchInput, { inputRef: createRef<HTMLInputElement>() }));

        const input = screen.getByPlaceholderText('Search for a building or street...');
        expect(input).toHaveAttribute('type', MAP_SEARCH_INPUT_ATTRIBUTES.type);
        expect(input).toHaveAttribute('name', MAP_SEARCH_INPUT_ATTRIBUTES.name);
        expect(input).toHaveAttribute('autocomplete', MAP_SEARCH_INPUT_ATTRIBUTES.autoComplete);
        expect(input).toHaveAttribute('data-lpignore', MAP_SEARCH_INPUT_ATTRIBUTES['data-lpignore']);
        expect(input).toHaveAttribute('data-1p-ignore');
        expect(input).toHaveAttribute('data-form-type', MAP_SEARCH_INPUT_ATTRIBUTES['data-form-type']);
    });
});

describe('Set Delivery Location warning', () => {
    it('shows the unsupported-address notice while the map is still loading', async () => {
        (window as TestWindow).__googleMapsLoaded = false;
        render(createElement(AddressForm, {
            userId: 'test-user',
            onSuccess: () => undefined,
            onCancel: () => undefined,
        }));

        fireEvent.click(screen.getByRole('button', { name: /Set delivery location on map/i }));
        const addressField = await screen.findByLabelText(/Complete Address/);
        fireEvent.change(addressField, { target: { value: 'Unit 1, Makati City' } });

        expect(screen.getByText('Not Serviceable Yet:')).toBeInTheDocument();
        expect(screen.queryByTestId('google-map-mock')).not.toBeInTheDocument();
    });

    it('shows the unsupported-address notice while typing and gives it priority over the suggested location', async () => {
        render(createElement(AddressForm, {
            userId: 'test-user',
            onSuccess: () => undefined,
            onCancel: () => undefined,
        }));

        fireEvent.click(screen.getByRole('button', { name: /Set delivery location on map/i }));
        const addressField = await screen.findByLabelText(/Complete Address/);

        await waitFor(() => expect(placeChanged).toBeTypeOf('function'));
        act(() => placeChanged?.());
        expect(await screen.findByText('Suggested Location:')).toBeInTheDocument();

        fireEvent.change(addressField, { target: { value: 'Unit 2, Pasig City, Metro Manila' } });
        expect(screen.getByText('Not Serviceable Yet:')).toBeInTheDocument();
        expect(screen.getByText('We currently only deliver to Cebu City, Mandaue, Talisay, Lapu-Lapu, Cordova, and Liloan.')).toBeInTheDocument();
        expect(screen.queryByText('Suggested Location:')).not.toBeInTheDocument();

        fireEvent.change(addressField, { target: { value: 'Unit 5, Cebu City, Cebu' } });
        expect(screen.queryByText('Not Serviceable Yet:')).not.toBeInTheDocument();
        expect(screen.getByText('Suggested Location:')).toBeInTheDocument();
    });
});
