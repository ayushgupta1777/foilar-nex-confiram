const express = require('express');
const Loan = require('../../models/loans/loanSchema'); // Adjust path as needed
const LoanProfile = require('../../models/loans/customer-land');
const { authenticateUser }  = require('../../middleware/authentication');
const router = express.Router();
const schedule = require('node-schedule');


// Fetch loan details by ID
// router.get('/loan-profile/:id', authenticateUser, async (req, res) => {
//   try {
//     userid = req.userId
//     const transactions = await Loan.find({ addedBy: userid }).sort({ createdAt: -1 });
//     if (!transactions) return res.status(404).json({ error: 'You are not Authorize' });

//     const loan = await Loan.findById(req.params.id).populate('customerID'); // Use populate if ref is added
//     if (!loan) return res.status(404).json({ error: 'Loan not found' });
//     res.json(loan);
//   } catch (error) {
//     console.error(error.message);
//     res.status(500).json({ error: 'Server Error' });
//   }
// });

router.get('/loan-profile2/:customerID', authenticateUser, async (req, res) => {
  try {
    const { customerID } = req.params;
    const userId = req.ByPhoneNumber;

    // Ensure only the user who added the loan can access it
    const loan = await LoanProfile.findOne({ customerID, ByPhoneNumber: userId }).populate('customerID');

    if (!loan) {
      return res.status(403).json({ error: 'Unauthorized: You do not have access to this loan' });
    }

    res.json(loan);
  } catch (error) {
    console.error('Error fetching loan profile:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

router.get('/transactions_loan', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId
    // Fetch all transactions added by the authenticated user
    
    const transactions = await Loan.find({ addedBy: req.userId }).sort({ createdAt: -1 });
    const profile = await LoanProfile.find({ ByPhoneNumber: req.ByPhoneNumber }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: transactions,
      profile1: profile,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Error fetching transactions', error });
  }
});

router.put('/update-transaction-status/:transactionId', async (req, res) => {
  try {
    const transaction = await Loan.findOne({ customerID: req.params.transactionId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    transaction.status = req.body.status; // Use the status from the request body
    await transaction.save();

    res.json({ message: 'Transaction updated successfully' });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ message: 'Error updating transaction status' });
  }
});


router.put('/transactions-loan/stop-interest/:transactionId', async (req, res) => {
  try {
    const transaction = await Loan.findOne({ customerID: req.params.transactionId });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    transaction.loanDetails.accruedInterest = 0; // Reset interest
    transaction.loanDetails.interestStartDate = new Date(); 
    console.log('Transaction Before Save:', transaction);
    await transaction.save();
    console.log('Transaction After Save:', transaction);
    res.json({ message: 'Interest calculation stopped successfully' });
  } catch (error) {
    console.error('Error stopping interest:', error);
    res.status(500).json({ message: 'Error stopping interest' });
  }
});

router.get('/search/transactions', authenticateUser, async (req, res) => {
  try {
    const { mobileNumber } = req.query;
    const userId = req.ByPhoneNumber; // Extract user ID from authenticated user

    if (!mobileNumber) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const transactions = await LoanProfile.find({
      'phoneNumber': mobileNumber, // Match by phone number
      ByPhoneNumber: userId, // Match by the user who added the transaction
    });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



const calculateDailyInterest = (amount, interestRate) => {
  const dailyRate = (interestRate / 100) / 30; // Daily interest rate
  return dailyRate * amount;
};


// function calculateCompoundInterest(principal, rate, startDate, frequency) {
//   const today = new Date();
//   const start = new Date(startDate);
//   const monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  
//   const n = frequency === 'Monthly' ? 12 : frequency === 'Quarterly' ? 4 : frequency === 'Half-Yearly' ? 2 : 1; // Compounding times per year
//   const timePeriods = monthsElapsed / (12 / n); // Convert months to compounding periods
//   const compoundRate = rate / (100 * n);
  
//   return principal * Math.pow(1 + compoundRate, timePeriods) - principal;
// }

// const calculateAccruedInterest = (amount, interestRate, startDate) => {
//   const today = new Date();
//   const start = new Date(startDate);
//   const elapsedDays = Math.floor((today - start) / (1000 * 60 * 60 * 24)); // Days since startDate
//   const dailyInterest = calculateDailyInterest(amount, interestRate);
//   return dailyInterest * elapsedDays;
// };

function calculateAccruedInterest(amount, rate, startDate ) {
  const today = new Date();
  const start = new Date(startDate);
  const daysElapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  const dailyRate = rate / 100 / 30; 
  


  return amount * dailyRate * daysElapsed;

}

// that comment is workcable for top up and agter todoen interest 

// function calculateTopUpInterest(amount, interestRate, startDate, topUpHistory, topDownHistory) {
//   const today = new Date();
//   const dailyRate = interestRate / 100 / 30; // Convert monthly rate to daily rate

//   let topUpInterest = 0;
//   let topUpTotal = 0;
//   let remainingPrincipal = amount;

//   // Step 1: Calculate initial accrued interest before any repayments
//   let accruedInterest = calculateAccruedInterest(amount, interestRate, startDate);

//   // Step 2: Process Top-Ups (Increase Principal)
//   if (topUpHistory && Array.isArray(topUpHistory)) {
//     topUpHistory.forEach(topUp => {
//       const start = new Date(topUp.date);
//       const daysElapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
//       const rate = parseFloat(topUp.topupinterestrate) || 0;
//       const dailyRate = rate / 100 / 30;

//       if (daysElapsed > 0) {
//         topUpInterest += topUp.amount * dailyRate * daysElapsed;
//       }
//       topUpTotal += topUp.amount;
//     });
//   }

//    // Step 1: Interest Before First Repayment
//    if (topDownHistory.length > 0) {
//     const firstRepaymentDate = new Date(topDownHistory[0].date);
//     const daysUntilFirstRepayment = Math.floor((firstRepaymentDate - lastRepaymentDate) / (1000 * 60 * 60 * 24));
//     totalInterest += remainingPrincipal * dailyRate * daysUntilFirstRepayment;
//   }
  

//   // Step 3: Process Top-Down Repayments (Reduce Principal)
//   if (topDownHistory && Array.isArray(topDownHistory)) {
//     topDownHistory.forEach(topDown => {
//       remainingPrincipal -= topDown.amount;
//       if (remainingPrincipal < 0) remainingPrincipal = 0; // Avoid negative values
      
//       topDown.redeem = amount;
//       topDown.amount = 0; // Reset top-down amount to avoid reprocessing
//     });
//   }

//   // Step 4: Adjust Interest Correctly After Repayment
//   // 🛑 Fix: Only add extra interest for remaining principal from repayment date onward, not from startDate!
//   const lastRepaymentDate = topDownHistory.length > 0 
//   ? new Date(topDownHistory[topDownHistory.length - 1].date) 
//   : new Date(startDate);


//   const remainingDays = Math.floor((today - lastRepaymentDate) / (1000 * 60 * 60 * 24));
//   const remainingInterest = remainingPrincipal * dailyRate * remainingDays;

//   return { 
//     topUpInterest, 
//     topUpTotal, 
//     topdownInterest: remainingInterest, 
//     topdownTotal: remainingPrincipal 
//   };
// }

function calculateTopUpInterest(amount, interestRate, startDate, topUpHistory, topDownHistory) {
  const today = new Date();
  const dailyRate = interestRate / 100 / 30; // Convert monthly rate to daily rate

  let totalInterest = 0;
  let remainingPrincipal = amount;
  let lastRepaymentDate = new Date(startDate);

  let accruedInterest = 0;
  let topUpInterest = 0;
  let topUpTotal = 0;

    // Step 1: Calculate accrued interest first
    accruedInterest = calculateAccruedInterest(amount, interestRate, startDate);

    // Step 2: Process Top-Ups (Increases Principal)
    if (topUpHistory && Array.isArray(topUpHistory)) {
      topUpHistory.forEach(topUp => {
        const start = new Date(topUp.date);
        const daysElapsed = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    
        const rate = parseFloat(topUp.topupinterestrate) || 0; // Get individual top-up interest rate
        const dailyRate = rate / 100 / 30; // Convert to daily rate
    
        if (daysElapsed > 0) { // Prevent future date issues
          topUpInterest += topUp.amount * dailyRate * daysElapsed;
        }
        topUpTotal += topUp.amount;
    
       
    
      }
    
    );
    }

  // Step 1: Interest Before First Repayment
  if (topDownHistory.length > 0) {
    const firstRepaymentDate = new Date(topDownHistory[0].date);
    const daysUntilFirstRepayment = Math.floor((firstRepaymentDate - lastRepaymentDate) / (1000 * 60 * 60 * 24));
    totalInterest += remainingPrincipal * dailyRate * daysUntilFirstRepayment;
  }

  // Step 2: Process Top-Down Repayments
  topDownHistory.forEach(topDown => {
    const repaymentDate = new Date(topDown.date);
    const daysSinceLastRepayment = Math.floor((repaymentDate - lastRepaymentDate) / (1000 * 60 * 60 * 24));

    // Calculate interest for the period before repayment
    totalInterest += remainingPrincipal * dailyRate * daysSinceLastRepayment;

    // Reduce principal after repayment
    remainingPrincipal -= topDown.amount;
    if (remainingPrincipal < 0) remainingPrincipal = 0;

    lastRepaymentDate = repaymentDate;

    topDown.redeem = amount;
    topDown.amount = 0;
  });

  // Step 3: Interest from Last Repayment Until Today
  const remainingDays = Math.floor((today - lastRepaymentDate) / (1000 * 60 * 60 * 24));
  totalInterest += remainingPrincipal * dailyRate * remainingDays;

  return { 
    topUpInterest, topUpTotal,
    topdownInterest: totalInterest, // 🔥 Total interest from start date till toda
    topdownTotal: remainingPrincipal 
  };
}



// function calculateTopDownRepayment(loan) {
//   let remainingPrincipal = loan.loanDetails.amount+ loan.loanDetails.topUpTotal ;
//   let remainingInterest = loan.loanDetails.accruedInterest + loan.loanDetails.topUpInterest;
//   let totalRepaid = 0;

//   if (Array.isArray(loan.loanDetails.topDownHistory)) {
//     loan.loanDetails.topDownHistory.forEach(payment => {
//       let paymentAmount = payment.amount;
//       totalRepaid += paymentAmount;

//       if (remainingInterest > 0) {
//         if (paymentAmount >= remainingInterest) {
//           paymentAmount -= remainingInterest;
//           remainingInterest = 0;
//         } else {
//           remainingInterest -= paymentAmount;
//           paymentAmount = 0;
//         }
//       }

//       if (paymentAmount > 0) {
//         remainingPrincipal -= paymentAmount;
//       }
//     });
//   }

//   if (remainingPrincipal < 0) remainingPrincipal = 0;

//   return { remainingPrincipal, remainingInterest, totalRepaid };
// }



// API to update interest

// function calculateTopDownRepayment(loan) {
//   let remainingPrincipal = loan.loanDetails.amount;
//   let remainingInterest = loan.loanDetails.accruedInterest + loan.loanDetails.topUpInterest;
//   let totalRepaid = 0;

//   // Sort repayments by date (oldest first)
//   let repayments = loan.loanDetails.topDownHistory || [];
//   repayments.sort((a, b) => new Date(a.date) - new Date(b.date));

//   let lastRepaymentDate = new Date(loan.loanDetails.startDate); // Start from loan start date
//   let today = new Date();

//   repayments.forEach(payment => {
//     let paymentDate = new Date(payment.date);
    
//     // Ignore future repayments
//     if (paymentDate > today) return;

//     let daysSinceLastPayment = Math.floor((paymentDate - lastRepaymentDate) / (1000 * 60 * 60 * 24));

//     // Apply accrued interest since last repayment
//     if (daysSinceLastPayment > 0) {
//       let dailyRate = loan.loanDetails.interestRate / 100 / 30; // Monthly to daily rate
//       let newInterest = remainingPrincipal * dailyRate * daysSinceLastPayment;
//       remainingInterest += newInterest;
//     }

//     let paymentAmount = payment.amount;
//     totalRepaid += paymentAmount;

//     console.log(`Processing repayment of ₹${paymentAmount} on ${paymentDate.toISOString()}`);
//     console.log(`Interest before repayment: ₹${remainingInterest.toFixed(2)}`);
//     console.log(`Principal before repayment: ₹${remainingPrincipal.toFixed(2)}`);

//     // Deduct interest first
//     if (remainingInterest > 0) {
//       if (paymentAmount >= remainingInterest) {
//         paymentAmount -= remainingInterest;
//         remainingInterest = 0;
//       } else {
//         remainingInterest -= paymentAmount;
//         paymentAmount = 0;
//       }
//     }

//     // Deduct principal if any payment amount is left
//     if (paymentAmount > 0) {
//       remainingPrincipal -= paymentAmount;
//     }

//     console.log(`Interest after repayment: ₹${remainingInterest.toFixed(2)}`);
//     console.log(`Principal after repayment: ₹${remainingPrincipal.toFixed(2)}`);
//     console.log("--------------------------");

//     lastRepaymentDate = paymentDate; // Update last repayment date
//   });

//   if (remainingPrincipal < 0) remainingPrincipal = 0;

//   return { remainingPrincipal, remainingInterest, totalRepaid };
// }






// router.put('/update-interest/:customerID', async (req, res) => {
//   try {
//     const loan = await Loan.findOne({ customerID: req.params.customerID });

//     if (!loan) {
//       return res.status(404).json({ message: 'Loan not found' });
//     }
 
//     let remainingPrincipal = loan.loanDetails.amount;


//     const accruedInterest = calculateAccruedInterest(
//       loan.loanDetails.amount,
//       loan.loanDetails.interestRate,
//       loan.loanDetails.startDate
 
//     );
//     const totalAmount = loan.loanDetails.amount + accruedInterest;

//     loan.loanDetails.accruedInterest = accruedInterest;
//     loan.loanDetails.totalAmount = totalAmount;

//     // remainingPrincipal = accruedResult.remainingPrincipal;
    
//      // Debug top-up history before calculation
//     console.log("Top-Up History before calculation:", loan.loanDetails.topUpHistory);

//     const topUpHistory = loan.loanDetails.topUpHistory || [];
//     const { topUpInterest, topUpTotal } = calculateTopUpInterest(topUpHistory, loan.loanDetails.interestRate 

//     );

//     loan.loanDetails.topUpInterest = topUpInterest;
//     loan.loanDetails.topUpTotal = topUpTotal;
//     loan.updatedAt = new Date();

//     // remainingPrincipal = topUpResult.remainingPrincipal;
//     // loan.loanDetails.remainingPrincipal = remainingPrincipal;

//     // Apply Top-Down Repayments
//     // const { remainingPrincipal, remainingInterest, totalRepaid } = calculateTopDownRepayment(loan);

//     // // Update loan details
//     // loan.loanDetails.accruedInterest = remainingInterest;
//     // loan.loanDetails.totalAmount = (remainingPrincipal || 0) + (remainingInterest || 0);
//     // loan.loanDetails.remainingPrincipal = remainingPrincipal;
//     // loan.loanDetails.topUpInterest = topUpInterest;
//     // loan.loanDetails.topUpTotal = topUpTotal;
//     // loan.loanDetails.totalRepaid = totalRepaid;
//     // loan.updatedAt = new Date();

    
    
//     await loan.save();

//     res.json({ message: 'Interest updated successfully', loan });
//   } catch (error) {
//     console.error('Error updating interest:', error);
//     res.status(500).json({ message: 'Error updating interest', error });
//   }
// });





// API to update interest

router.put('/update-interest/:customerID', async (req, res) => {
  try {
    const loan = await Loan.findOne({ customerID: req.params.customerID });

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const accruedInterest = calculateAccruedInterest(
      loan.loanDetails.amount,
      loan.loanDetails.interestRate,
      loan.loanDetails.startDate
    );
    const totalAmount = loan.loanDetails.amount + accruedInterest;

    // Update loan details
    loan.loanDetails.accruedInterest = accruedInterest;
    loan.loanDetails.totalAmount = totalAmount;
    loan.updatedAt = new Date();

    // Debug top-up history before calculation
    console.log("Top-Up History before calculation:", loan.loanDetails.topUpHistory);

    const topUpHistory = loan.loanDetails.topUpHistory || [];
    const { topUpInterest, topUpTotal, topdownInterest, topdownTotal } = calculateTopUpInterest(
      loan.loanDetails.amount, 
      loan.loanDetails.interestRate, 
      loan.loanDetails.startDate, 
      topUpHistory, 
      loan.loanDetails.topDownHistory || []

    );

   


    loan.loanDetails.topUpInterest = topUpInterest; 
    loan.loanDetails.topUpTotal = topUpTotal;

    // Debug calculated values before saving
    console.log("Top-Up Interest:", topUpInterest);
    console.log("Top-Up Total:", topUpTotal);

    // Update loan details with top-up calculations
    // loan.loanDetails.topUpInterest = topUpInterest;
    // loan.loanDetails.topUpTotal = topUpTotal;

      loan.loanDetails.accruedInterest = topdownInterest;
      loan.loanDetails.amount = topdownTotal;
    loan.updatedAt = new Date();

    await loan.save(); // ✅ Now properly saving updates

    res.json({ message: 'Interest updated successfully', loan });
  } catch (error) {
    console.error('Error updating interest:', error);
    res.status(500).json({ message: 'Error updating interest', error });
  }
});




schedule.scheduleJob('0 0 * * *', async () => {
  console.log('Running scheduled interest update...');
  try {
    const loans = await Loan.find({ 'loanDetails.interestMethod': 'Simple', status: 'active' });

    for (const loan of loans) {
      const { amount, interestRate, startDate } = loan.loanDetails;
      const accruedInterest = calculateAccruedInterest(amount, interestRate, startDate);
      const totalAmount = amount + accruedInterest;

      loan.loanDetails.accruedInterest = accruedInterest;
      loan.loanDetails.totalAmount = totalAmount;
      loan.updatedAt = new Date();

      await loan.save();
    }

    console.log('Interest updated successfully for all loans.');
  } catch (err) {
    console.error('Error updating interest:', err);
  }
});


// Top-Up Endpoint
router.put('/top-up/:customerID', async (req, res) => {
  const { customerID } = req.params;
  const { topUpAmount } = req.body;

  if (!topUpAmount || topUpAmount <= 0) {
    return res.status(400).json({ error: 'Invalid top-up amount.' });
  }

  try {
    // Find the loan details by customer ID
    const loan = await Loan.findOne({ customerID: customerID }).populate('customerID');
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found.' });
    }

    // Update the loan amount (add top-up amount)
    loan.loanDetails.amount += parseFloat(topUpAmount);

    // Recalculate total amount and interest (if needed)
    const { amount, interestRate, startDate } = loan.loanDetails;
    const today = new Date();

    // Calculate accrued interest
    const elapsedDays = Math.floor((today - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const dailyRate = interestRate / 100 / 30; // Assuming 30 days in a month
    const accruedInterest = dailyRate * amount * elapsedDays;

    // Update loan details
    loan.loanDetails.accruedInterest = accruedInterest;
    loan.loanDetails.totalAmount = amount + accruedInterest;

    // Save updated loan details
    await loan.save();

    res.json(loan); // Send updated loan details as response
  } catch (err) {
    console.error('Error processing top-up:', err);
    res.status(500).json({ error: 'Failed to process top-up. Please try again.' });
  }
});


module.exports = router;
