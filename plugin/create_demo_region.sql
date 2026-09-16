set define off
set verify off
prompt --application/pages/page_00001/create_demo_region
--------------------------------------------------------------------------------
-- PayloadLens for Oracle APEX -- demo region
-- https://github.com/B2DEV-TECH/apex-payload-lens
-- Copyright (c) B2DEV TECH. Released under the MIT License.
--
-- Adds a PayloadLens region to page 1 of the PayloadLens Demo application,
-- wired to a synthetic (example.com/example.test-only) order-webhook JSON
-- payload, so the plug-in has a real, inspectable usage example once a UI
-- theme is applied to the application (Shared Components > User Interface >
-- Themes > Create, copying the Universal Theme -- standard for any new
-- blank application, and intentionally not scripted here since it is pure
-- shared/reusable Apex-supplied theme content, not part of the plug-in).
--
-- KNOWN LIMITATION (verified against a live APEX 26.1 instance): the region
-- itself and its plug-in binding (source type NATIVE_PLUGIN, this plug-in)
-- are created correctly by this script, but the p_attribute_01.. values
-- below are not reliably persisted by wwv_flow_imp.create_page_plug when
-- called standalone like this, outside a full Application Export/Import or
-- Page Designer save. If Page Designer shows this region's attributes
-- blank after running the script, just re-enter them once by hand -- the
-- values to use are exactly the ones passed below (source type Static,
-- the JSON in l_payload, display mode tree, sensitive keys as listed,
-- etc.). This is a limitation of seeding data via this low-level import
-- API, not of the plug-in's own render code.
--------------------------------------------------------------------------------

declare
    l_region_id number;

    l_payload varchar2(4000) := '{
  "eventId": "evt_8f14e45fceea167a5a36dedd4bea2543",
  "eventType": "order.created",
  "occurredAt": "2026-09-16T12:30:00Z",
  "source": "https://api.example.com/webhooks/orders",
  "order": {
    "id": "ORD-100245",
    "status": "PENDING",
    "currency": "USD",
    "totalAmount": 129.90,
    "items": [
      { "sku": "SKU-1001", "name": "Wireless Mouse", "quantity": 2, "unitPrice": 29.95 },
      { "sku": "SKU-2044", "name": "USB-C Hub", "quantity": 1, "unitPrice": 69.99 }
    ]
  },
  "customer": {
    "id": "cust_38210",
    "name": "Jane Example",
    "email": "jane.example@example.com",
    "phone": "+1-555-0100"
  },
  "payment": {
    "method": "CREDIT_CARD",
    "cardNumber": "4111111111111111",
    "cardHolder": "JANE EXAMPLE",
    "token": "tok_1H8x2eLkjhASDFasdf9087",
    "authCode": "AUTH-99231"
  },
  "shippingAddress": {
    "line1": "123 Example Street",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62704",
    "country": "US"
  },
  "metadata": {
    "webhookSignature": "sha256=9f3f5a2c7b8e4d1a0c6f2b8e4d1a0c6f2b8e4d1a0c6f2b8e4d1a0c6f2b8e4d1a",
    "apiKey": "example-fake-api-key-not-a-real-secret-000000",
    "notes": "Synthetic demo payload for PayloadLens -- not real customer data."
  }
}';
begin
    wwv_flow_imp.component_begin(
        p_version_yyyy_mm_dd      => '2025.09.15',
        p_release                 => '26.1.0',
        p_default_workspace_id    => 16201359295616937,
        p_default_application_id => 4471082935610274 );

    l_region_id := wwv_flow_imp.id(6142307958201743);

    wwv_flow_imp.create_page_plug(
        p_id                    => l_region_id,
        p_page_id               => 1,
        p_plug_name             => 'Order Webhook Payload',
        p_region_name           => 'ORDER_PAYLOAD',
        p_plug_display_point    => 'BODY',
        p_plug_display_sequence => 10,
        p_plug_source_type      => 'NATIVE_PLUGIN',
        p_plug_source           => 'B2DEVTECH.PAYLOAD_LENS',
        p_attribute_01          => 'STATIC',
        p_attribute_02          => l_payload,
        p_attribute_05          => 'tree',
        p_attribute_06          => '3',
        p_attribute_07          => 'Y',
        p_attribute_08          => 'Y',
        p_attribute_09          => 'Y',
        p_attribute_10          => 'Y',
        p_attribute_11          => 'cardNumber, token, apiKey, webhookSignature, authCode',
        p_attribute_12          => 'N',
        p_attribute_13          => '*',
        p_attribute_14          => '1048576' );

    wwv_flow_imp.component_end;

    dbms_output.put_line('PAYLOAD_LENS_DEMO_REGION_ID=' || l_region_id);
end;
/
show errors

prompt --PayloadLens demo region create complete.
