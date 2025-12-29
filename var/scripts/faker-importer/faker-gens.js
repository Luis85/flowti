export function createGens(faker) {
  const gens = {
    customer: () => ({
      id: faker.string.uuid(),
      customer_number: `C-${faker.number.int({ min: 10000, max: 99999 })}`,
      name: faker.company.name(),
      segment: faker.helpers.arrayElement(["SMB", "Enterprise", "Public", "Partner"]),
      industry: faker.company.buzzPhrase(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      payment_terms: faker.helpers.arrayElement(["Net 30", "Net 45", "Net 60", "Prepaid"]),
      billing_address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        zip: faker.location.zipCode(),
        country: faker.location.country(),
      },
      shipping_address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        zip: faker.location.zipCode(),
        country: faker.location.country(),
      },
    }),

    contact: () => ({
      id: faker.string.uuid(),
      customer_number: `C-${faker.number.int({ min: 10000, max: 99999 })}`,
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      full_name: faker.person.fullName(),
      role: faker.helpers.arrayElement(["Buyer", "Operations", "Finance", "Engineering"]),
      email: faker.internet.email(),
      phone: faker.phone.number(),
    }),

    product: () => ({
      id: faker.string.uuid(),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      category: faker.commerce.department(),
      price: Number(faker.commerce.price()),
      currency: "USD",
      is_active: faker.datatype.boolean(),
    }),

    sales_order: () => ({
      id: faker.string.uuid(),
      so_number: `SO-${faker.number.int({ min: 100000, max: 999999 })}`,
      customer_number: `C-${faker.number.int({ min: 10000, max: 99999 })}`,
      order_date: faker.date.recent({ days: 30 }).toISOString(),
      status: faker.helpers.arrayElement(["New", "Confirmed", "In Fulfillment", "Shipped", "Invoiced"]),
      payment_terms: faker.helpers.arrayElement(["Net 30", "Net 45", "Net 60", "Prepaid"]),
      currency: "USD",
      total_amount: Number(faker.commerce.price({ min: 100, max: 20000 })),
    }),

    sales_order_line: () => ({
      id: faker.string.uuid(),
      so_number: `SO-${faker.number.int({ min: 100000, max: 999999 })}`,
      line_number: faker.number.int({ min: 1, max: 10 }),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      description: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 20 }),
      unit_price: Number(faker.commerce.price({ min: 10, max: 500 })),
      currency: "USD",
    }),

    invoice: () => ({
      id: faker.string.uuid(),
      invoice_number: `INV-${faker.number.int({ min: 100000, max: 999999 })}`,
      so_number: `SO-${faker.number.int({ min: 100000, max: 999999 })}`,
      customer_number: `C-${faker.number.int({ min: 10000, max: 99999 })}`,
      invoice_date: faker.date.recent({ days: 30 }).toISOString(),
      due_date: faker.date.soon({ days: 30 }).toISOString(),
      status: faker.helpers.arrayElement(["Open", "Paid", "Overdue", "Cancelled"]),
      total_amount: Number(faker.commerce.price({ min: 100, max: 20000 })),
      currency: "USD",
    }),

    shipment: () => ({
      id: faker.string.uuid(),
      shipment_number: `SHP-${faker.number.int({ min: 100000, max: 999999 })}`,
      so_number: `SO-${faker.number.int({ min: 100000, max: 999999 })}`,
      ship_date: faker.date.recent({ days: 10 }).toISOString(),
      carrier: faker.helpers.arrayElement(["UPS", "DHL", "FedEx", "USPS", "DHL Express"]),
      tracking_number: faker.string.alphanumeric(18).toUpperCase(),
      status: faker.helpers.arrayElement(["Label Created", "Shipped", "In Transit", "Delivered"]),
      ship_from_warehouse: `WH-${faker.number.int({ min: 1, max: 5 })}`,
    }),

    supplier: () => ({
      id: faker.string.uuid(),
      supplier_number: `V-${faker.number.int({ min: 1000, max: 9999 })}`,
      name: faker.company.name(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      payment_terms: faker.helpers.arrayElement(["Net 30", "Net 45", "Net 60", "Prepaid"]),
      country: faker.location.country(),
      is_preferred: faker.datatype.boolean(),
    }),

    purchase_order: () => ({
      id: faker.string.uuid(),
      po_number: `PO-${faker.number.int({ min: 100000, max: 999999 })}`,
      supplier_number: `V-${faker.number.int({ min: 1000, max: 9999 })}`,
      order_date: faker.date.recent({ days: 30 }).toISOString(),
      status: faker.helpers.arrayElement(["Open", "Partially Received", "Closed", "Cancelled"]),
      expected_receipt_date: faker.date.soon({ days: 30 }).toISOString(),
      currency: "USD",
      total_amount: Number(faker.commerce.price({ min: 100, max: 20000 })),
    }),

    purchase_order_line: () => ({
      id: faker.string.uuid(),
      po_number: `PO-${faker.number.int({ min: 100000, max: 999999 })}`,
      line_number: faker.number.int({ min: 1, max: 20 }),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      description: faker.commerce.productName(),
      quantity: faker.number.int({ min: 1, max: 100 }),
      unit_cost: Number(faker.commerce.price({ min: 5, max: 500 })),
      currency: "USD",
    }),

    goods_receipt: () => ({
      id: faker.string.uuid(),
      gr_number: `GR-${faker.number.int({ min: 100000, max: 999999 })}`,
      po_number: `PO-${faker.number.int({ min: 100000, max: 999999 })}`,
      receipt_date: faker.date.recent({ days: 10 }).toISOString(),
      warehouse: `WH-${faker.number.int({ min: 1, max: 5 })}`,
      received_by: faker.person.fullName(),
    }),

    item: () => ({
      id: faker.string.uuid(),
      sku: faker.string.alphanumeric(10).toUpperCase(),
      description: faker.commerce.productName(),
      long_description: faker.commerce.productDescription(),
      uom: faker.helpers.arrayElement(["EA", "SET", "KG", "M"]),
      is_inventory_item: faker.datatype.boolean(),
      is_active: faker.datatype.boolean(),
      product_group: faker.helpers.arrayElement(["HARDWARE", "SERVICE", "CONSUMABLE", "SPAREPART"]),
    }),

    warehouse: () => ({
      id: faker.string.uuid(),
      warehouse_code: `WH-${faker.number.int({ min: 1, max: 20 })}`,
      name: `${faker.location.city()} Warehouse`,
      type: faker.helpers.arrayElement(["Main", "Regional", "Consignment", "3PL"]),
      country: faker.location.country(),
      city: faker.location.city(),
    }),

    bin: () => ({
      id: faker.string.uuid(),
      warehouse_code: `WH-${faker.number.int({ min: 1, max: 20 })}`,
      bin_code: `BIN-${faker.number.int({ min: 100, max: 999 })}`,
      zone: faker.helpers.arrayElement(["A", "B", "C", "D"]),
      bin_type: faker.helpers.arrayElement(["Pick", "Bulk", "Overflow", "Returns"]),
    }),

    inventory_transaction: () => ({
      id: faker.string.uuid(),
      transaction_number: `IT-${faker.number.int({ min: 100000, max: 999999 })}`,
      sku: faker.string.alphanumeric(10).toUpperCase(),
      warehouse_code: `WH-${faker.number.int({ min: 1, max: 20 })}`,
      bin_code: `BIN-${faker.number.int({ min: 100, max: 999 })}`,
      transaction_type: faker.helpers.arrayElement(["Receipt", "Issue", "Adjustment", "Transfer"]),
      quantity: faker.number.int({ min: -50, max: 50 }),
      transaction_date: faker.date.recent({ days: 60 }).toISOString(),
      reference: faker.helpers.arrayElement([
        "Sales Order",
        "Purchase Order",
        "Cycle Count",
        "Inventory Adjustment",
      ]),
    }),

    payment: () => ({
      id: faker.string.uuid(),
      payment_number: `PAY-${faker.number.int({ min: 100000, max: 999999 })}`,
      invoice_number: `INV-${faker.number.int({ min: 100000, max: 999999 })}`,
      payment_date: faker.date.recent({ days: 60 }).toISOString(),
      amount: Number(faker.commerce.price({ min: 50, max: 20000 })),
      currency: "USD",
      method: faker.helpers.arrayElement(["Wire", "Credit Card", "ACH", "Cash"]),
      status: faker.helpers.arrayElement(["Open", "Applied", "Cancelled"]),
    }),

    employee: () => ({
      id: faker.string.uuid(),
      employee_number: `E-${faker.number.int({ min: 1000, max: 9999 })}`,
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      full_name: faker.person.fullName(),
      role: faker.helpers.arrayElement([
        "Operations Specialist",
        "Sales Engineer",
        "Director Operations",
        "Warehouse Lead",
      ]),
      department: faker.helpers.arrayElement([
        "Operations",
        "Sales",
        "Finance",
        "Warehouse",
        "IT",
      ]),
      email: faker.internet.email(),
    }),

    project: () => ({
      id: faker.string.uuid(),
      project_code: `PRJ-${faker.number.int({ min: 1000, max: 9999 })}`,
      name: faker.commerce.productName() + " Implementation",
      owner: faker.person.fullName(),
      status: faker.helpers.arrayElement(["Planned", "In Progress", "On Hold", "Completed"]),
      start_date: faker.date.past({ years: 1 }).toISOString(),
      end_date: faker.date.soon({ days: 90 }).toISOString(),
      budget: Number(faker.commerce.price({ min: 10000, max: 500000 })),
      currency: "USD",
    }),

    task: () => ({
      id: faker.string.uuid(),
      title: faker.hacker.phrase(),
      description: faker.lorem.sentences({ min: 1, max: 3 }),
      state: faker.helpers.arrayElement(["New", "In Progress", "Blocked", "Done"]),
      assignee: faker.person.fullName(),
      due_date: faker.date.soon({ days: 30 }).toISOString(),
      priority: faker.helpers.arrayElement(["Low", "Medium", "High", "Critical"]),
    }),

    requirement: () => ({
      id: faker.string.uuid(),
      key: `REQ-${faker.number.int({ min: 1000, max: 9999 })}`,
      title: faker.hacker.phrase(),
      description: faker.lorem.paragraph(),
      state: faker.helpers.arrayElement(["New", "Scoping", "Discovery", "Ready", "Done"]),
      story_points: faker.number.int({ min: 1, max: 13 }),
      priority: faker.helpers.arrayElement(["Low", "Medium", "High", "Critical"]),
      owner: faker.person.fullName(),
    }),
    
    character: () => ({
		  id: faker.string.uuid(),
		  handle: faker.internet.username(),
		  display_name: faker.person.fullName(),
		  archetype: faker.helpers.arrayElement([
		    "Operations Specialist",
		    "Sales Engineer",
		    "Delivery Manager",
		    "Product Owner",
		    "UX Designer",
		    "Architect",
		    "Developer"
		  ]),
		  level: faker.number.int({ min: 1, max: 20 }),
		  xp: faker.number.int({ min: 0, max: 5000 }),
		  primary_skill: faker.helpers.arrayElement([
		    "Facilitation",
		    "Domain Modeling",
		    "Testing",
		    "Data Analysis",
		    "Architecture",
		    "Story Mapping"
		  ]),
		  secondary_skill: faker.helpers.arrayElement([
		    "Service Design",
		    "Event Storming",
		    "System Design",
		    "Requirements Engineering",
		    "Coaching"
		  ]),
		  faction: faker.helpers.arrayElement([
		    "Business",
		    "Tech",
		    "Operations",
		    "Leadership"
		  ]),
		}),
		
		quest: () => ({
		  id: faker.string.uuid(),
		  code: `Q-${faker.number.int({ min: 1000, max: 9999 })}`,
		  title: faker.company.catchPhrase(),
		  description: faker.lorem.sentences({ min: 1, max: 3 }),
		  domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay",
		    "Inventory Management",
		    "Service Design",
		    "System Design",
		    "Event Storming"
		  ]),
		  difficulty: faker.helpers.arrayElement(["Easy", "Normal", "Hard", "Epic"]),
		  reward_xp: faker.number.int({ min: 50, max: 500 }),
		  owner: faker.person.fullName(),
		  state: faker.helpers.arrayElement(["New", "Planned", "In Progress", "Completed"]),
		}),
		
		quest_step: () => ({
		  id: faker.string.uuid(),
		  quest_code: `Q-${faker.number.int({ min: 1000, max: 9999 })}`,
		  step_number: faker.number.int({ min: 1, max: 10 }),
		  title: faker.hacker.verb() + " " + faker.hacker.noun(),
		  description: faker.lorem.sentence(),
		  artifact_type: faker.helpers.arrayElement([
		    "Service Blueprint",
		    "Event Storming Board",
		    "C4 Diagram",
		    "User Journey",
		    "Process Map"
		  ]),
		  expected_duration_minutes: faker.number.int({ min: 15, max: 180 }),
		  difficulty: faker.helpers.arrayElement(["Easy", "Normal", "Hard"]),
		}),
		
		xp_event: () => ({
		  id: faker.string.uuid(),
		  character_handle: faker.internet.username(),
		  event_type: faker.helpers.arrayElement([
		    "Workshop Facilitated",
		    "Process Mapped",
		    "Event Storming Completed",
		    "System Context Modeled",
		    "Scenario Tested"
		  ]),
		  xp_change: faker.number.int({ min: 10, max: 300 }),
		  timestamp: faker.date.recent({ days: 10 }).toISOString(),
		  related_domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay",
		    "Workshop",
		    "System Design"
		  ]),
		}),
		
		service_touchpoint: () => ({
		  id: faker.string.uuid(),
		  name: faker.company.buzzPhrase(),
		  channel: faker.helpers.arrayElement([
		    "Website",
		    "Email",
		    "Phone",
		    "Onsite",
		    "E-Commerce",
		    "Support Portal"
		  ]),
		  actor: faker.helpers.arrayElement([
		    "Customer",
		    "Sales",
		    "Operations",
		    "Warehouse",
		    "Support"
		  ]),
		  stage: faker.helpers.arrayElement([
		    "Discover",
		    "Evaluate",
		    "Order",
		    "Fulfill",
		    "Support"
		  ]),
		  description: faker.lorem.sentence(),
		}),
		
		service_lane: () => ({
		  id: faker.string.uuid(),
		  name: faker.helpers.arrayElement([
		    "Customer",
		    "Frontstage",
		    "Backstage",
		    "Support",
		    "Partner"
		  ]),
		  role_example: faker.person.jobTitle(),
		  domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay",
		    "Service Delivery"
		  ]),
		}),
		
		business_event: () => ({
		  id: faker.string.uuid(),
		  name: faker.helpers.arrayElement([
		    "Order Placed",
		    "Order Confirmed",
		    "Payment Received",
		    "Goods Shipped",
		    "Invoice Sent",
		    "Stock Replenished"
		  ]),
		  description: faker.lorem.sentence(),
		  domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay",
		    "Inventory"
		  ]),
		  category: faker.helpers.arrayElement([
		    "Domain Event",
		    "Integration Event",
		    "Business Trigger"
		  ]),
		}),
		
		command: () => ({
		  id: faker.string.uuid(),
		  name: faker.helpers.arrayElement([
		    "Place Order",
		    "Confirm Order",
		    "Ship Goods",
		    "Generate Invoice",
		    "Book Payment",
		    "Replenish Stock"
		  ]),
		  actor: faker.helpers.arrayElement([
		    "Customer",
		    "Sales",
		    "Operations",
		    "System"
		  ]),
		  description: faker.lorem.sentence(),
		  domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay"
		  ]),
		}),
		
		system_component: () => ({
		  id: faker.string.uuid(),
		  name: faker.helpers.arrayElement([
		    "ERP",
		    "CRM",
		    "Warehouse System",
		    "E-Commerce Shop",
		    "Payment Gateway",
		    "Reporting / BI"
		  ]),
		  type: faker.helpers.arrayElement(["System", "Container", "Component"]),
		  responsibility: faker.lorem.sentence(),
		  owner_team: faker.helpers.arrayElement([
		    "IT",
		    "Operations",
		    "Sales",
		    "Data"
		  ]),
		}),
		
		workshop_session: () => ({
		  id: faker.string.uuid(),
		  title: faker.helpers.arrayElement([
		    "Order-to-Cash Event Storming",
		    "Service Blueprint for Returns",
		    "System Design: Inventory Domain",
		    "Customer Journey Mapping"
		  ]),
		  facilitator: faker.person.fullName(),
		  format: faker.helpers.arrayElement([
		    "Remote",
		    "Onsite",
		    "Hybrid"
		  ]),
		  duration_minutes: faker.number.int({ min: 60, max: 240 }),
		  domain: faker.helpers.arrayElement([
		    "Order to Cash",
		    "Purchase to Pay",
		    "Service Design",
		    "Architecture"
		  ]),
		  goal: faker.lorem.sentence(),
		}),
		
		test_scenario: () => {
      const id = faker.string.uuid();
      const domain = faker.helpers.arrayElement([
        "Order to Cash",
        "Purchase to Pay",
        "Inventory",
        "Service Delivery"
      ]);

      return {
        id,
        scenario_type: "test",
        name: `Test Scenario: ${faker.hacker.verb()} ${faker.hacker.noun()}`,
        description: faker.lorem.sentences({ min: 2, max: 4 }),
        domain,
        goal: faker.helpers.arrayElement([
          "Validate critical business flow",
          "Reproduce a production bug",
          "Explore edge cases in integration",
          "Verify regression coverage"
        ]),
        primary_actor: {
          name: faker.person.fullName(),
          role: faker.helpers.arrayElement([
            "QA Engineer", "Developer", "Product Owner", "Operations Specialist"
          ])
        },
        secondary_actors: Array.from({ length: 2 }, () => ({
          name: faker.person.fullName(),
          role: faker.person.jobTitle()
        })),
        sipoc: {
          suppliers: Array.from({ length: 2 }, () => faker.company.name()),
          inputs: [
            "User story",
            "Business rule",
            "Test data set",
            faker.helpers.arrayElement(["Incoming order file", "API event", "Portal submission"])
          ],
          process_steps: [
            "Prepare test data",
            "Execute scenario",
            "Capture results",
            "Log defects"
          ],
          outputs: [
            "Test report",
            "Defect tickets",
            "Updated acceptance criteria"
          ],
          customers: [
            "Product Owner",
            "Operations",
            "Business Stakeholders"
          ]
        },
        events: Array.from({ length: 4 }, () => ({
          type: faker.helpers.arrayElement(["DomainEvent", "TechnicalEvent"]),
          name: faker.helpers.arrayElement([
            "Order Placed",
            "Payment Received",
            "Shipment Triggered",
            "Error Logged"
          ]),
          note: faker.lorem.sentence()
        })),
        systems_involved: Array.from({ length: 3 }, () => ({
          name: faker.helpers.arrayElement([
            "ERP", "CRM", "Warehouse System", "E-Commerce Shop", "Reporting / BI"
          ]),
          responsibility: faker.lorem.sentence()
        })),
        risks: Array.from({ length: 2 }, () => ({
          description: faker.lorem.sentence(),
          likelihood: faker.helpers.arrayElement(["Low", "Medium", "High"]),
          impact: faker.helpers.arrayElement(["Low", "Medium", "High"])
        })),
        metrics: {
          expected_duration_minutes: faker.number.int({ min: 10, max: 120 }),
          max_allowed_defects: faker.number.int({ min: 0, max: 10 })
        }
      };
    },

    user_scenario: () => {
      const id = faker.string.uuid();
      const domain = faker.helpers.arrayElement([
        "Self-Service Portal",
        "E-Commerce Shop",
        "Support Journey",
        "Onboarding Flow"
      ]);

      return {
        id,
        scenario_type: "user",
        name: `User Scenario: ${faker.company.catchPhrase()}`,
        description: faker.lorem.sentences({ min: 2, max: 4 }),
        domain,
        primary_user: {
          persona_name: faker.person.fullName(),
          role: faker.helpers.arrayElement([
            "Customer", "Buyer", "Warehouse Manager", "Support Agent"
          ]),
          need: faker.lorem.sentence()
        },
        context: {
          trigger: faker.helpers.arrayElement([
            "New order request",
            "Issue with existing order",
            "Need for documentation",
            "Stock information"
          ]),
          channel: faker.helpers.arrayElement([
            "Web", "Mobile", "Phone", "Email", "Onsite"
          ]),
          preconditions: [
            "User has valid account",
            faker.lorem.sentence()
          ],
          postconditions: [
            "Request is visible in O2C process",
            "User receives confirmation"
          ]
        },
        sipoc: {
          suppliers: ["Customer", "Sales", "Operations"],
          inputs: [
            "User request",
            "Customer master data",
            "Product catalog"
          ],
          process_steps: [
            "User navigates to entry point",
            "User submits request",
            "System validates data",
            "System triggers follow-up process"
          ],
          outputs: [
            "Order / Ticket created",
            "Confirmation message",
            "Follow-up tasks"
          ],
          customers: ["Customer", "Internal Stakeholders"]
        },
        touchpoints: Array.from({ length: 3 }, () => ({
          channel: faker.helpers.arrayElement(["Web", "Email", "Phone", "Portal"]),
          step: faker.lorem.sentence(),
          emotion: faker.helpers.arrayElement(["😊", "😐", "😟"])
        })),
        business_events: Array.from({ length: 3 }, () => ({
          name: faker.helpers.arrayElement([
            "Request Submitted",
            "Request Validated",
            "Order Created",
            "Case Closed"
          ]),
          description: faker.lorem.sentence()
        })),
        systems_involved: Array.from({ length: 2 }, () => ({
          name: faker.helpers.arrayElement([
            "Portal", "CRM", "ERP", "Ticket System"
          ]),
          responsibility: faker.lorem.sentence()
        }))
      };
    },

    product_scenario: () => {
      const id = faker.string.uuid();
      const productName = faker.commerce.productName();

      return {
        id,
        scenario_type: "product",
        name: `Product Scenario: ${productName}`,
        description: faker.lorem.sentences({ min: 2, max: 4 }),
        product: {
          sku: faker.string.alphanumeric(10).toUpperCase(),
          name: productName,
          category: faker.commerce.department(),
          price: Number(faker.commerce.price({ min: 100, max: 20000 })),
          currency: "USD"
        },
        lifecycle_stage: faker.helpers.arrayElement([
          "Idea", "MVP", "Scaling", "Mature", "Sunset"
        ]),
        goal: faker.helpers.arrayElement([
          "Increase adoption",
          "Reduce churn",
          "Improve conversion rate",
          "Align with new business model"
        ]),
        sipoc: {
          suppliers: ["Product Team", "Vendors", "Operations"],
          inputs: [
            "Market research",
            "Backlog",
            "Customer feedback",
            "Usage data"
          ],
          process_steps: [
            "Define product vision",
            "Prioritize features",
            "Implement & test",
            "Launch & learn"
          ],
          outputs: [
            "Product increment",
            "Release notes",
            "Updated documentation"
          ],
          customers: [
            "End Users",
            "Sales",
            "Support"
          ]
        },
        key_events: Array.from({ length: 3 }, () => ({
          name: faker.helpers.arrayElement([
            "Release Deployed",
            "Feature Flag Enabled",
            "Major Incident",
            "A/B Test Completed"
          ]),
          description: faker.lorem.sentence()
        })),
        metrics: {
          target_kpi: faker.helpers.arrayElement([
            "Activation rate",
            "Adoption",
            "Time-to-value",
            "Support tickets"
          ]),
          baseline: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
          target: faker.number.float({ min: 0, max: 1, precision: 0.01 })
        }
      };
    },

    service_scenario: () => {
      const id = faker.string.uuid();
      const domain = faker.helpers.arrayElement([
        "Order to Cash",
        "Returns",
        "Onboarding",
        "Support Case Handling"
      ]);

      return {
        id,
        scenario_type: "service",
        name: `Service Scenario: ${domain}`,
        description: faker.lorem.sentences({ min: 2, max: 4 }),
        domain,
        customer_segment: faker.helpers.arrayElement([
          "New Customer", "Key Account", "SMB", "Enterprise"
        ]),
        lanes: [
          "Customer",
          "Frontstage",
          "Backstage",
          "Support",
          "Partner"
        ],
        sipoc: {
          suppliers: ["Customer", "Sales", "Operations", "IT"],
          inputs: [
            "Order / Request",
            "Master data",
            "Service contract",
            "System capabilities"
          ],
          process_steps: [
            "Receive request",
            "Validate and classify",
            "Execute service",
            "Communicate result"
          ],
          outputs: [
            "Fulfilled service",
            "Notifications",
            "Updated records"
          ],
          customers: [
            "Customer",
            "Internal stakeholders"
          ]
        },
        touchpoints: Array.from({ length: 4 }, () => ({
          lane: faker.helpers.arrayElement([
            "Customer",
            "Frontstage",
            "Backstage",
            "Support"
          ]),
          channel: faker.helpers.arrayElement([
            "Phone", "Email", "Portal", "Onsite"
          ]),
          step: faker.lorem.sentence()
        })),
        business_events: Array.from({ length: 4 }, () => ({
          name: faker.helpers.arrayElement([
            "Service Request Created",
            "Service Accepted",
            "Service Completed",
            "Feedback Received"
          ]),
          lane: faker.helpers.arrayElement([
            "Customer", "Frontstage", "Backstage", "Support"
          ])
        })),
        systems_involved: Array.from({ length: 3 }, () => ({
          name: faker.helpers.arrayElement([
            "ERP", "CRM", "Ticketing", "Knowledge Base", "Portal"
          ]),
          responsibility: faker.lorem.sentence()
        })),
        risks: Array.from({ length: 2 }, () => ({
          description: faker.lorem.sentence(),
          mitigation: faker.lorem.sentence()
        }))
      };
    },

  };

  return gens;
}
