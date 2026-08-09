import { render, screen } from '@testing-library/react';
import { createElement, createRef } from 'react';
import { describe, expect, it } from 'vitest';
import {
    getGooglePlaceLocationDetails,
    MAP_SEARCH_INPUT_ATTRIBUTES,
    MapSearchInput,
} from './AddressForm';

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
