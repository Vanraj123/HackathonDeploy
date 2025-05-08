import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ScoreContext } from '../context/ScoreContext';

const BASE_URL = 'http://localhost:8080/api/score';

const CalculateScore = () => {
    const navigate = useNavigate();
    const { score, setScore, scoreFactors, setScoreFactors, updateTrigger } = useContext(ScoreContext);
    const [userId, setUserId] = useState(null);
    const [formData, setFormData] = useState({
        monthlyIncome: '',
        grocerySpending: '',
        utilityBills: '',
        totalSavings: '',
        rentEmi: '',
        medicalExpenses: '',
        transportationCost: '',
        loanRepayment: ''
    });
    const [localScore, setLocalScore] = useState(300);
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');
    const [isCalculating, setIsCalculating] = useState(false); // Add a loading state


    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserId(user.id);
        } else {
            console.warn("User ID not found in local storage. Redirecting to login.");
            navigate('/login');
        }
    }, [navigate]);

useEffect(() => {
  const fetchScoreData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      let userId;


      if (storedUser) {
        const user = JSON.parse(storedUser);
        userId = user.id;
        if (!userId) {
          console.warn("Dashboard: User ID not found in local storage. Redirecting to login.");
          navigate('/login');
          return;
        }
      } else {
        console.warn("Dashboard: No user logged in. Redirecting to login.");
        navigate('/login');
        return;
      }


      console.log('Dashboard: Fetching score for userId:', userId);
      const response = await axios.get(`${BASE_URL}/${userId}`);
      console.log("Dashboard: Fetched Score Data:", response.data);


      if (response.data && response.data.score) {
        setScore(response.data.score);
        localStorage.setItem('score', response.data.score);
        // setScoreFactors({
        //   income: response.data.monthlyIncome ?? 0,
        //   spending: response.data.grocerySpending ?? 0,
        //   savings: response.data.totalSavings ?? 0,
        //   loans: response.data.loanRepayment ?? 0,
        //   locationConsistency: response.data.rentOrEmi ?? 0,
        //   transactionHistory: response.data.utilityBills ?? 0
        // });
      //   generateLoanOffers(response.data.score);
      } else {
        navigate("/calculate-score");
      }
    } catch (error) {
      console.error("Dashboard: Error fetching score data:", error);
    }
  };


  if (score === null || updateTrigger > 0) {
    fetchScoreData();
  } else {
  //   generateLoanOffers(score);
  }


}, [score, updateTrigger, navigate, setScore, setScoreFactors]);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: Number(value)
        }));
    };

    const calculateMLScore = async () => {
        if (!userId) {
            console.error("User ID is not available. Cannot calculate score.");
            setError("User session expired. Please log in again.");
            navigate('/login');
            return;
        }

        setIsCalculating(true); // Start calculating
        setError(''); // Clear any previous errors

        try {
            console.log("Sending request to ML API at: http://localhost:5001/predict");
            console.log("Request Data:", formData);

            const mlResponse = await axios.post("http://localhost:5001/predict", formData, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (mlResponse.data) {
                console.log("ML API Response:", mlResponse.data);
                const category = mlResponse.data.credit_rating;
                setCategory(category);

                let adjustedScore = 300;
                switch (category) {
                    case "Excellent":
                        adjustedScore += 10;
                        break;
                    case "Good":
                        adjustedScore += 5;
                        break;
                    case "Bad":
                        adjustedScore -= 5;
                        break;
                    case "Very Poor":
                        adjustedScore -= 10;
                        break;
                    default:
                        break;
                }
                adjustedScore = Math.max(adjustedScore, 300);
                setLocalScore(adjustedScore);

                console.log("Updated Score:", adjustedScore);
                console.log("Sending final data to backend for userId:", userId);

                const backendResponse = await axios.post(`${BASE_URL}/calculate/${userId}`, {
                    monthly_income: formData.monthlyIncome,
                    grocery_spending: formData.grocerySpending,
                    utility_bills: formData.utilityBills,
                    savings: formData.totalSavings,
                    rent_or_emi: formData.rentEmi,
                    medical_expense: formData.medicalExpenses,
                    transport: formData.transportationCost,
                    loan_repayment: formData.loanRepayment,
                    category: category,
                    score: adjustedScore
                });

                console.log("Stored in Backend:", backendResponse.data);

                // Get full data back from backend to ensure consistency
                const updatedData = backendResponse.data;

                // Now set score in context with data from backend
                setScore(updatedData.score || adjustedScore);  // Ensure a score is always set
                setScoreFactors({
                    income: ((updatedData.monthlyIncome || formData.monthlyIncome || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100,
                    spending: ((updatedData.grocerySpending || formData.grocerySpending || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100,
                    savings: ((updatedData.totalSavings || formData.totalSavings || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100,
                    loans: ((updatedData.loanRepayment || formData.loanRepayment || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100,
                    locationConsistency: ((updatedData.rentOrEmi || formData.rentEmi || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100,
                    transactionHistory: ((updatedData.utilityBills || formData.utilityBills || 0)/(updatedData.monthlyIncome || formData.monthlyIncome || 0))*100
                });

                // Trigger update AFTER setting context values
                // triggerUpdate(prev => prev + 1);

                // Navigate immediately
                navigate('/dashboard');

            } else {
                setError("Failed to get data from ML API");
            }

        } catch (err) {
            console.error("Error fetching ML category or storing data:", err);
            setError(err.response?.data?.error || 'Error calculating ML score');
        } finally {
            setIsCalculating(false); // End calculating
        }
    };

    return (
        <div className="container py-5">
            <div className="row justify-content-center">
                <div className="col-md-8">
                    <div className="card shadow-sm border-0">
                        <div className="card-body p-4">
                            <h2 className="mb-4 text-center">Calculate Your Financial Score</h2>
                            {error && <div className="alert alert-danger">{error}</div>}
                            {/* {localScore && (
                                // <div className="alert alert-success">
                                //     Base Score: {localScore} 
                                // </div>
                            )} */}
                            <form>
                                {Object.keys(formData).map((key, index) => (
                                    <div className="mb-3" key={index}>
                                        <label className="form-label">{key.replace(/([A-Z])/g, " $1").trim()} (INR)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            name={key}
                                            value={formData[key]}
                                            onChange={handleChange}
                                            min="0"
                                        />
                                    </div>
                                ))}
                                <div className="d-grid mt-4">
                                    <button type="button" className="btn btn-primary btn-lg" onClick={calculateMLScore}>
                                        Get ML Score
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default CalculateScore;
