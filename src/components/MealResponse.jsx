import React, { useEffect, useState } from "react";

function MealResponse({ response, onRegenerate, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  const [ingredients, setIngredients] = useState(null);
  const [groceryMatches, setGroceryMatches] = useState([]);
  useEffect(() => {
    setConfirmed(false);
    setIngredients(null);
  }, [response]);
  if (!response) return null;

  // Try parsing the response as JSON
  let parsed;
  try {
    parsed = typeof response === "string" ? JSON.parse(response) : response;
  } catch (err) {
    return <p className="plain-response">{response}</p>;
  }

  const { meal_plan, ingredients: ingr } = parsed;

  const handleYes = async () => {
    setConfirmed(true);
    setIngredients(ingr);

    if (typeof onConfirm === "function") {
      onConfirm(ingr); // optional: pass ingredients to parent if needed
    }

    // 🔁 Send to backend
    try {
      const res = await fetch("http://localhost:3001/api/grocery-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingr }),
      });

      const data = await res.json();
      console.log("🛒 Grocery Matches:", data.matches);
      setGroceryMatches(data.matches || []);

      // You can also store the matches in state to display (optional)
      // setMatchedProducts(data.matches);
    } catch (error) {
      console.error("❌ Error fetching groceries:", error);
    }
  };

  const handleNo = () => {
    setConfirmed(false);
    setIngredients(null);
    if (typeof onRegenerate === "function") {
      onRegenerate(); // parent triggers new plan
    }
  };

  return (
    <div className="structured-response">
      {!confirmed && meal_plan && (
        <>
          <h3
            style={{
              fontWeight: "bold",
              fontSize: "2.4rem",
              color: "#5C4033",
              fontFamily: "'Chakra Petch', sans-serif",
              fontStyle: "italic",
              margin: "0",
            }}
          >
            Here's your meal plan suggestion:
          </h3>

          {Object.entries(meal_plan).map(([day, meals]) => (
            <div
              key={day}
              style={{
                marginBottom: "1rem",
              }}
            >
              <h4
                style={{
                  fontWeight: "bold",
                  fontSize: "1.5rem",
                  color: "#4B4B4B",
                  fontFamily: '"Savate", sans-serif',
                  fontOpticalSizing: "auto",
                  fontWeight: "700",
                  fontStyle: "normal",
                }}
              >
                {day}:
              </h4>
              <ul
                style={{
                  marginLeft: "1.5rem",
                  listStyleType: "disc",
                  color: "black",
                }}
              >
                {Object.entries(meals).map(([mealTime, mealItem]) => (
                  <li key={mealTime}>
                    <strong
                      style={{
                        fontFamily: '"Courgette", cursive',
                        fontStyle: "normal",
                        color: "#4B352A",
                        fontSize: "20px",
                      }}
                    >
                      {mealTime}:
                    </strong>{" "}
                    <strong
                      style={{
                        fontFamily: '"Advent Pro", sans-serif',
                        fontOpticalSizing: "auto",
                        fontWeight: 700,
                        fontStyle: "normal",
                        fontSize: "20px",
                        color: "#B22222",
                      }}
                    >
                      {mealItem}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p
              style={{
                fontFamily: '"Tagesschrift", system-ui',
                fontWeight: 400,
                fontStyle: "normal",
                fontSize: "30px",
              }}
            >
              You wanna go ahead with this meal plan?
            </p>
            <button
              onClick={handleYes}
              style={{
                marginRight: "1rem",
                padding: "6px 12px",
                color: "white",
                background: "#77B254",
                borderRadius: "9999px",
                border: "2px solid #222",
                fontSize: "1.2rem",
                fontWeight: 500,
                boxShadow: "4px 4px 0px #222",
                cursor: "pointer",
                transition: "transform 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translate(-2px, -2px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "none";
              }}
            >
              Yes
            </button>
            <button
              onClick={handleNo}
              style={{
                marginRight: "1rem",
                padding: "6px 12px",
                color: "white",
                background: "#FF3F33",
                borderRadius: "9999px",
                border: "2px solid #222",
                fontSize: "1.2rem",
                fontWeight: 500,
                boxShadow: "4px 4px 0px #222",
                cursor: "pointer",
                transition: "transform 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "translate(3px, -3px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = "none";
              }}
            >
              No, regenerate
            </button>
          </div>
        </>
      )}

      {confirmed && ingredients && (
        <>
          <h3
            style={{ fontWeight: "bold", fontSize: "1.3rem", color: "black" }}
          >
            🧾 Ingredients You'll Need:
          </h3>
          <ul
            style={{
              marginLeft: "1.5rem",
              listStyleType: "square",
              color: "black",
            }}
          >
            {ingredients.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {confirmed && groceryMatches.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ fontSize: "1.5rem", color: "#333" }}>
            🛍️ Matching Grocery Items
          </h3>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0e68c" }}>
                <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                  Ingredient
                </th>
                <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                  Product Name
                </th>
                <th style={{ border: "1px solid #ddd", padding: "8px" }}>
                  Image
                </th>
              </tr>
            </thead>
            <tbody>
              {groceryMatches.map((match, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                    {match.ingredient}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                    {match.product ? match.product.name : "❌ Not Found"}
                  </td>
                  <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                    {match.product?.image_url ? (
                      <img
                        src={match.product.image_url}
                        alt={match.product.name}
                        style={{
                          height: "50px",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MealResponse;
